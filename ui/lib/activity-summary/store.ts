import { Redis } from '@upstash/redis'
import type { ActivitySummary } from './prompt'

// Bump the version whenever the summary's shape or how it is generated
// changes, so a new deploy regenerates instead of serving a summary stored
// by older code for the rest of the day.
const KEY_VERSION = 'v2'
const KEY_PREFIX = `activity-summary:${KEY_VERSION}`
const DAY_TTL_SECONDS = 30 * 24 * 60 * 60
// Longer than one generation (collect + Groq) so a slow run keeps the lock.
const LOCK_TTL_SECONDS = 90

// The subset of the Upstash client this module uses, so tests can pass a fake.
export type SummaryStore = {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<unknown>
  del(key: string): Promise<unknown>
}

export function getSummaryRedis(): SummaryStore | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token }) as unknown as SummaryStore
}

// Preview deployments and local dev share the production Upstash database, so
// keys are namespaced by environment. Otherwise a preview could store a
// summary under the key production reads for the rest of the day.
export function summaryEnv(): string {
  return process.env.VERCEL_ENV || 'development'
}

export function summaryKeys(now: Date, env: string = summaryEnv()) {
  const prefix = `${KEY_PREFIX}:${env}`
  return {
    day: `${prefix}:${now.toISOString().slice(0, 10)}`,
    latest: `${prefix}:latest`,
    lock: `${prefix}:lock`,
  }
}

export type SummaryResult = {
  summary: ActivitySummary | null
  source: 'cache' | 'fresh' | 'fallback' | 'none'
}

/**
 * Returns today's summary, generating it at most once per UTC day. Concurrent
 * requests that miss the cache while another request holds the lock get the
 * most recent earlier summary instead of starting a second generation. A
 * failed generation also falls back to the most recent summary.
 */
export async function getOrCreateSummary(params: {
  store: SummaryStore | null
  generate: () => Promise<ActivitySummary | null>
  now?: Date
}): Promise<SummaryResult> {
  const { store, generate } = params

  // No Redis (local dev): generate on every request.
  if (!store) {
    const summary = await generate()
    return { summary, source: summary ? 'fresh' : 'none' }
  }

  const keys = summaryKeys(params.now ?? new Date())

  const cached = await store.get<ActivitySummary>(keys.day)
  if (cached) return { summary: cached, source: 'cache' }

  const fallback = async (): Promise<SummaryResult> => {
    const latest = await store.get<ActivitySummary>(keys.latest)
    return { summary: latest, source: latest ? 'fallback' : 'none' }
  }

  const acquired = await store.set(keys.lock, '1', { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) return fallback()

  try {
    const summary = await generate()
    if (!summary) return fallback()
    await Promise.all([
      store.set(keys.day, summary, { ex: DAY_TTL_SECONDS }),
      store.set(keys.latest, summary),
    ])
    return { summary, source: 'fresh' }
  } finally {
    await store.del(keys.lock)
  }
}
