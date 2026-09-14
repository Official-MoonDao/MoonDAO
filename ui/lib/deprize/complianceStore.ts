import { Redis } from '@upstash/redis'

export function getComplianceRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function execCompliancePipeline(
  apply: (pipeline: ReturnType<Redis['pipeline']>) => void
): Promise<boolean> {
  const cache = getComplianceRedis()
  if (!cache) {
    console.error('[deprize] compliance store skipped: redis is not configured')
    return false
  }
  try {
    const pipeline = cache.pipeline()
    apply(pipeline)
    await pipeline.exec()
    return true
  } catch (err) {
    console.error('[deprize] compliance pipeline failed', err)
    return false
  }
}

export async function scanComplianceKeys(match: string): Promise<string[]> {
  const cache = getComplianceRedis()
  if (!cache) return []
  const keys: string[] = []
  let cursor: string | number = 0
  do {
    const [next, batch] = (await cache.scan(cursor, { match, count: 200 })) as [
      string | number,
      string[],
    ]
    keys.push(...batch)
    cursor = next
  } while (cursor !== 0 && cursor !== '0')
  return keys
}
