import { Redis } from '@upstash/redis'

/**
 * Short-lived cache of Typeform answers keyed by responseId.
 *
 * Typeform's `/responses` API can lag 10-30s behind a submission while it
 * indexes. A webhook (see /api/typeform/webhook) fires almost immediately, so
 * we stash the answers here and let onboarding polls read them instantly
 * instead of waiting on the slow API.
 */

const RESPONSE_CACHE_TTL_SECONDS = 60 * 60 // 1 hour — only needed during onboarding

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function cacheKey(responseId: string): string {
  return `typeform:resp:${responseId}`
}

export type CachedTypeformResponse = {
  answers: any[]
  /** ms epoch the answers were cached, for debugging/observability. */
  cachedAt: number
}

export async function cacheTypeformAnswers(
  responseId: string,
  answers: any[]
): Promise<void> {
  const client = getRedis()
  if (!client || !responseId || !answers) return
  try {
    const payload: CachedTypeformResponse = { answers, cachedAt: Date.now() }
    await client.set(cacheKey(responseId), payload, {
      ex: RESPONSE_CACHE_TTL_SECONDS,
    })
  } catch (err) {
    console.warn('[typeform] Failed to cache answers:', err)
  }
}

export async function readCachedTypeformAnswers(
  responseId: string
): Promise<any[] | null> {
  const client = getRedis()
  if (!client || !responseId) return null
  try {
    const cached = await client.get<CachedTypeformResponse>(cacheKey(responseId))
    if (cached?.answers && Array.isArray(cached.answers)) {
      return cached.answers
    }
  } catch (err) {
    console.warn('[typeform] Failed to read cached answers:', err)
  }
  return null
}
