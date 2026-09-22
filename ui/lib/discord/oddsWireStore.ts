import { Redis } from '@upstash/redis'

export function getOddsWireRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function oddsWireKeys(chainSlug: string, deprizeId: number) {
  return {
    snapshot: `deprize:oddswire:${chainSlug}:${deprizeId}`,
    health: `deprize:oddswire:health:${chainSlug}:${deprizeId}`,
    lock: `deprize:oddswire:lock:${chainSlug}:${deprizeId}`,
  }
}

export function discordGuildThrottleKey(guildId: string): string {
  return `deprize:discord:rl:${guildId}`
}
