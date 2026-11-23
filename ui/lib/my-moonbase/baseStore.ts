/**
 * Saved bases, on the site's existing Upstash Redis.
 *
 *   <prefix>:a:<wallet>   JSON   { id, layout, updatedAt }   the base saved under a wallet
 *   <prefix>:i:<id>       string wallet                      which wallet a share id belongs to
 *   <prefix>:p:<wallet>   JSON   picks read for visitors     short-lived cache
 *
 * Bases do not expire. Only the production deployment uses the live prefix
 * (isLiveBoard, shared with the game leaderboards), so local and preview
 * testing never writes over a real base.
 *
 * Server only.
 */
import { Ratelimit } from '@upstash/ratelimit'
import type { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import { isLiveBoard, leaderboardRedis } from '@/lib/touchdown/leaderboardStore'
import type { MoonbaseLayout } from './grid'
import { baseIdFromBytes, isBaseId } from './share'
import type { SavedBase } from './sync'

export { leaderboardRedis as baseRedis }

const ID_ATTEMPTS = 5

function prefix(env: Record<string, string | undefined> = process.env): string {
  return `moonbase:base:${isLiveBoard(env) ? 'prod' : 'dev'}`
}

function ownerKey(wallet: string): string {
  return `${prefix()}:a:${wallet.toLowerCase()}`
}

function idKey(id: string): string {
  return `${prefix()}:i:${id}`
}

export function picksCacheKey(wallet: string): string {
  return `${prefix()}:p:${wallet.toLowerCase()}`
}

/** Called when the owner saves, so a new pick shows on their shared base right away. */
export async function forgetVisitorPicks(redis: Redis, wallet: string): Promise<void> {
  await redis.del(picksCacheKey(wallet)).catch(() => {})
}

/**
 * Saves per connection. The builder saves a couple of seconds after the last
 * edit, so steady building is about one save every few seconds.
 */
export function saveLimiter(redis: Redis): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(240, '10 m'),
    prefix: `${prefix()}:rl`,
  })
}

function parseSaved(raw: unknown): SavedBase | null {
  // Upstash hands JSON back parsed, but a value written as a string stays one.
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const saved = value as Partial<SavedBase>
  if (!isBaseId(saved.id) || typeof saved.updatedAt !== 'number' || !saved.layout) return null
  return { id: saved.id, layout: saved.layout, updatedAt: saved.updatedAt }
}

export async function readBaseByOwner(redis: Redis, wallet: string): Promise<SavedBase | null> {
  return parseSaved(await redis.get(ownerKey(wallet)))
}

/** The base behind a share id, and the wallet it is saved under. */
export async function readBaseById(
  redis: Redis,
  id: string
): Promise<{ owner: string; base: SavedBase } | null> {
  if (!isBaseId(id)) return null
  const owner = await redis.get<string>(idKey(id))
  if (typeof owner !== 'string' || !owner) return null
  const base = await readBaseByOwner(redis, owner)
  // The id must still be the one the base carries.
  return base && base.id === id ? { owner, base } : null
}

async function claimId(redis: Redis, wallet: string): Promise<string> {
  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
    const id = baseIdFromBytes(randomBytes(16))
    const claimed = await redis.set(idKey(id), wallet.toLowerCase(), { nx: true })
    if (claimed) return id
  }
  throw new Error('could not allocate a base id')
}

export type WriteResult =
  | { ok: true; base: SavedBase }
  /** The account copy is not the one the browser last saw. */
  | { ok: false; base: SavedBase }

/**
 * Saves `layout` under `wallet`. `expected` is the `updatedAt` the browser
 * last saw, or null when it saw no saved base. A mismatch saves nothing and
 * returns the copy that is there, unless `force` is set.
 */
export async function writeBase(
  redis: Redis,
  wallet: string,
  layout: MoonbaseLayout,
  expected: number | null,
  options: { force?: boolean; now?: number } = {}
): Promise<WriteResult> {
  const current = await readBaseByOwner(redis, wallet)
  if (!options.force && (current?.updatedAt ?? null) !== expected) {
    if (current) return { ok: false, base: current }
    // The browser remembers a save this store has no record of. Take the layout.
  }
  const id = current?.id ?? (await claimId(redis, wallet))
  const now = options.now ?? Date.now()
  // Strictly later than the copy it replaces, whatever the clock says.
  const updatedAt = current ? Math.max(now, current.updatedAt + 1) : now
  const base: SavedBase = { id, layout, updatedAt }
  await redis.set(ownerKey(wallet), JSON.stringify(base))
  return { ok: true, base }
}
