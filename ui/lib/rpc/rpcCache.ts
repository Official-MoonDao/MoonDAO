/**
 * Tiny server-side cache for JSON-RPC results, backed by Upstash Redis with a
 * bounded in-memory fallback (per-lambda).
 *
 * Motivation: the browser RPC proxy (`/api/rpc/[chainId]`) and the gas-price
 * endpoint forward every read straight to Infura, so identical reads fired by
 * many visitors (mission pages, dashboards, gas estimates) each burn credits.
 * Caching idempotent reads for a couple of seconds collapses those duplicates
 * across all clients without meaningfully staling the UI.
 *
 * Everything here fails open: if Redis is unavailable or slow the caller still
 * gets a correct (uncached) response.
 */
import crypto from 'crypto'
import { Redis } from '@upstash/redis'

let redis: Redis | null | undefined

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  redis = url && token ? new Redis({ url, token }) : null
  return redis
}

export const RPC_CACHE_DISABLED = process.env.RPC_CACHE_DISABLED === 'true'

// Guard Redis round-trips so a slow/unreachable endpoint never delays a read.
const REDIS_TIMEOUT_MS = 1500

async function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_TIMEOUT_MS)),
  ])
}

// Per-lambda memory cache. Bounded so a long-lived instance can't grow forever.
const MEM_MAX_ENTRIES = 5000
const mem = new Map<string, { value: unknown; expiresAt: number }>()

function memGet(key: string): unknown | undefined {
  const hit = mem.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    mem.delete(key)
    return undefined
  }
  return hit.value
}

function memSet(key: string, value: unknown, ttlMs: number): void {
  if (mem.size >= MEM_MAX_ENTRIES) {
    // Cheap eviction: drop the oldest inserted key.
    const oldest = mem.keys().next().value
    if (oldest !== undefined) mem.delete(oldest)
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/** Stable JSON stringify (sorted object keys) so equivalent params share a key. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`
}

export function hashKey(parts: string): string {
  return crypto.createHash('sha1').update(parts).digest('hex')
}

/** Batch read. Returns an array aligned to `keys`; misses are `undefined`. */
export async function cacheGetMany(keys: string[]): Promise<(unknown | undefined)[]> {
  if (RPC_CACHE_DISABLED || keys.length === 0) return keys.map(() => undefined)

  const results: (unknown | undefined)[] = keys.map((k) => memGet(k))
  const missingIdx = results
    .map((v, i) => (v === undefined ? i : -1))
    .filter((i) => i >= 0)

  if (missingIdx.length === 0) return results

  const client = getRedis()
  if (!client) return results

  const missingKeys = missingIdx.map((i) => keys[i])
  const fetched = await withTimeout<(unknown | null)[]>(
    client.mget<(unknown | null)[]>(...missingKeys),
    missingKeys.map(() => null)
  )

  missingIdx.forEach((origIdx, j) => {
    const val = fetched[j]
    if (val !== null && val !== undefined) results[origIdx] = val
  })

  return results
}

/** Fire-and-forget writes. Also populates the in-memory tier synchronously. */
export async function cacheSetMany(
  entries: { key: string; value: unknown; ttlMs: number }[]
): Promise<void> {
  if (RPC_CACHE_DISABLED || entries.length === 0) return

  for (const { key, value, ttlMs } of entries) {
    memSet(key, value, ttlMs)
  }

  const client = getRedis()
  if (!client) return

  try {
    const pipeline = client.pipeline()
    for (const { key, value, ttlMs } of entries) {
      pipeline.set(key, value, { px: ttlMs })
    }
    await withTimeout(pipeline.exec(), undefined as unknown as unknown[])
  } catch {
    /* fail open — memory tier still serves subsequent reads */
  }
}

export async function cacheGet(key: string): Promise<unknown | undefined> {
  const [value] = await cacheGetMany([key])
  return value
}

export async function cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  await cacheSetMany([{ key, value, ttlMs }])
}
