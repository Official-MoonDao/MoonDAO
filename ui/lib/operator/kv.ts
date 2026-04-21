import { Redis } from '@upstash/redis'

// Shared client for operator-controlled flags. Backed by Upstash Redis (same
// store the rate-limiter and geo cache use). Vercel KV is Upstash under the
// hood, so this works on Vercel without any extra env vars.
//
// Required env: UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN.

let cachedRedis: Redis | null = null

export function getRedis(): Redis {
  if (cachedRedis) return cachedRedis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    throw new Error(
      'Upstash Redis is not configured. Set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN.'
    )
  }
  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

// All operator flags share a single namespace so they're easy to enumerate /
// purge. Append the human-readable key to this prefix.
export const OPERATOR_FLAG_PREFIX = 'moondao:operator:flag:'

export type OperatorFlagRecord<T = Record<string, unknown>> = T & {
  enabled: boolean
  setBy?: string
  note?: string
  setAt?: string // ISO timestamp; stringified for JSON-friendly storage
  expiresAt?: string | null
}

// Read a flag. Returns null if missing or if Redis is unreachable so callers
// can fall back to a safe default without blowing up the request.
export async function readOperatorFlag<T extends OperatorFlagRecord>(
  key: string
): Promise<T | null> {
  try {
    const redis = getRedis()
    const value = await redis.get<T | string | null>(`${OPERATOR_FLAG_PREFIX}${key}`)
    if (value == null) return null
    // Upstash returns parsed JSON for objects, but tolerate string values too
    // in case someone wrote a raw payload manually.
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch {
        return null
      }
    }
    return value
  } catch (err) {
    console.error(`readOperatorFlag(${key}) failed:`, err)
    return null
  }
}

// Write a flag, optionally with a TTL (in seconds) for auto-expiry.
export async function writeOperatorFlag<T extends OperatorFlagRecord>(
  key: string,
  payload: T,
  opts?: { expiresAt?: Date | null }
): Promise<T> {
  const redis = getRedis()
  const fullKey = `${OPERATOR_FLAG_PREFIX}${key}`

  const record: T = {
    ...payload,
    setAt: payload.setAt || new Date().toISOString(),
    expiresAt:
      opts?.expiresAt instanceof Date
        ? opts.expiresAt.toISOString()
        : opts?.expiresAt === null
        ? null
        : payload.expiresAt ?? null,
  }

  if (opts?.expiresAt instanceof Date) {
    const ttlSec = Math.max(
      1,
      Math.floor((opts.expiresAt.getTime() - Date.now()) / 1000)
    )
    await redis.set(fullKey, record, { ex: ttlSec })
  } else if (opts?.expiresAt === null) {
    // Explicit clear: drop any existing TTL.
    await redis.set(fullKey, record)
  } else {
    await redis.set(fullKey, record)
  }

  return record
}
