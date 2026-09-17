import { Redis } from '@upstash/redis'
import { FORECAST_MAX_ENTRIES_PER_UTC_DAY, forecastEnv } from './constants'
import { parseJson, assertForecastVersion, UnknownForecastSchemaError } from './schema'

export type ForecastLatest = {
  v: 1
  vector: number[]
  updatedAt: string
  weights: number[]
}

export type ForecastHistoryEntry = {
  v: 1
  at: string
  vector: number[]
}

export type ForecastProfile = {
  v: 1
  displayName: string
  optIn: boolean
  updatedAt: string
}

export type ForecastVoid = {
  v: 1
  reason: 'superseded' | 'cancelled'
  at: string
  liveTipId?: number
}

export function getForecastRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function forecastKeys(chainSlug: string, deprizeId: number, userId?: string) {
  const env = forecastEnv()
  const book = `forecast:${env}:${chainSlug}:${deprizeId}`
  return {
    env,
    book,
    latest: userId ? `${book}:user:${userId}:latest` : '',
    history: userId ? `${book}:user:${userId}:history` : '',
    users: `${book}:users`,
    books: `forecast:${env}:books`,
    void: `${book}:void`,
    profile: userId ? `forecast:profile:${env}:${userId}` : '',
    erasureEpoch: `forecast:erasure:${env}:epoch`,
    bookRef: `${chainSlug}:${deprizeId}`,
  }
}

function asLatest(raw: unknown): ForecastLatest {
  const parsed = parseJson<ForecastLatest>(raw)
  assertForecastVersion(parsed)
  if (!parsed || !Array.isArray(parsed.vector) || !Array.isArray(parsed.weights)) {
    throw new UnknownForecastSchemaError(parsed?.v)
  }
  return parsed
}

function asHistoryEntry(raw: unknown): ForecastHistoryEntry {
  const parsed = parseJson<ForecastHistoryEntry>(raw)
  assertForecastVersion(parsed)
  if (!parsed || !Array.isArray(parsed.vector) || typeof parsed.at !== 'string') {
    throw new UnknownForecastSchemaError(parsed?.v)
  }
  return parsed
}

function asVoid(raw: unknown): ForecastVoid | null {
  if (raw == null) return null
  const parsed = parseJson<ForecastVoid>(raw)
  assertForecastVersion(parsed)
  return parsed
}

function asProfile(raw: unknown): ForecastProfile | null {
  if (raw == null) return null
  const parsed = parseJson<ForecastProfile>(raw)
  assertForecastVersion(parsed)
  return parsed
}

export async function readVoid(
  redis: Redis,
  chainSlug: string,
  deprizeId: number
): Promise<ForecastVoid | null> {
  const keys = forecastKeys(chainSlug, deprizeId)
  return asVoid(await redis.get(keys.void))
}

export async function writeVoid(
  redis: Redis,
  chainSlug: string,
  deprizeId: number,
  tombstone: ForecastVoid
): Promise<void> {
  const keys = forecastKeys(chainSlug, deprizeId)
  await redis.set(keys.void, tombstone)
}

export async function readLatest(
  redis: Redis,
  chainSlug: string,
  deprizeId: number,
  userId: string
): Promise<ForecastLatest | null> {
  const keys = forecastKeys(chainSlug, deprizeId, userId)
  const raw = await redis.get(keys.latest)
  if (raw == null) return null
  return asLatest(raw)
}

export async function readHistory(
  redis: Redis,
  chainSlug: string,
  deprizeId: number,
  userId: string
): Promise<ForecastHistoryEntry[]> {
  const keys = forecastKeys(chainSlug, deprizeId, userId)
  const raw = (await redis.lrange(keys.history, 0, -1)) ?? []
  return raw.map(asHistoryEntry)
}

export async function readProfile(
  redis: Redis,
  userId: string
): Promise<ForecastProfile | null> {
  const keys = forecastKeys('sepolia', 0, userId)
  const raw = await redis.get(keys.profile)
  if (raw == null) return null
  return asProfile(raw)
}

export async function listBookUsers(
  redis: Redis,
  chainSlug: string,
  deprizeId: number
): Promise<string[]> {
  const keys = forecastKeys(chainSlug, deprizeId)
  return (await redis.smembers(keys.users)) ?? []
}

export async function listBooks(redis: Redis): Promise<string[]> {
  const keys = forecastKeys('sepolia', 0)
  return (await redis.smembers(keys.books)) ?? []
}

export function entriesOnUtcDay(history: ForecastHistoryEntry[], day: string): number {
  return history.filter((entry) => entry.at.slice(0, 10) === day).length
}

export async function writeForecast(args: {
  redis: Redis
  chainSlug: string
  deprizeId: number
  userId: string
  latest: ForecastLatest
  historyEntry: ForecastHistoryEntry
}): Promise<void> {
  const keys = forecastKeys(args.chainSlug, args.deprizeId, args.userId)
  const pipeline = args.redis.pipeline()
  pipeline.set(keys.latest, args.latest)
  pipeline.rpush(keys.history, args.historyEntry)
  pipeline.sadd(keys.users, args.userId)
  pipeline.sadd(keys.books, keys.bookRef)
  await pipeline.exec()
}

export async function writeProfile(
  redis: Redis,
  userId: string,
  profile: ForecastProfile
): Promise<void> {
  const keys = forecastKeys('sepolia', 0, userId)
  await redis.set(keys.profile, profile)
}

export async function eraseUser(redis: Redis, userId: string): Promise<void> {
  const books = await listBooks(redis)
  const pipeline = redis.pipeline()
  for (const ref of books) {
    const [chainSlug, idRaw] = ref.split(':')
    const deprizeId = Number(idRaw)
    if (!chainSlug || !Number.isFinite(deprizeId)) continue
    const keys = forecastKeys(chainSlug, deprizeId, userId)
    pipeline.del(keys.latest)
    pipeline.del(keys.history)
    pipeline.srem(keys.users, userId)
  }
  const profileKeys = forecastKeys('sepolia', 0, userId)
  pipeline.del(profileKeys.profile)
  pipeline.incr(profileKeys.erasureEpoch)
  await pipeline.exec()
}

export { UnknownForecastSchemaError, FORECAST_MAX_ENTRIES_PER_UTC_DAY }
