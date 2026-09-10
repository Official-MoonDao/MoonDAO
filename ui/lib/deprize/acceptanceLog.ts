import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'

export type AcceptanceRecord = {
  wallet: string
  termsVersion: string
  timestamp: string
  country: string | null
  userAgent: string
  ipHash: string | null
}

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

function key(wallet: string, termsVersion: string): string {
  return `deprize:accept:${wallet.toLowerCase()}:${termsVersion}`
}

export async function recordTermsAcceptance(record: AcceptanceRecord): Promise<boolean> {
  const cache = redis()
  if (!cache) {
    console.error('[deprize] acceptance log skipped: redis is not configured')
    return false
  }
  try {
    await cache.set(key(record.wallet, record.termsVersion), record)
    return true
  } catch (err) {
    console.error('[deprize] acceptance log write failed', err)
    return false
  }
}
