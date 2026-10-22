import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import type { NextApiRequest } from 'next'

export type SubscribeRateLimiter = {
  limitIp: (ip: string) => Promise<boolean>
  limitEmail: (normalizedEmail: string) => Promise<boolean>
}

/**
 * Per IP and per normalized email. Returns null when Upstash is not configured
 * so a missing Redis does not take the signup form down.
 */
export function productionSubscribeLimiter(
  env: Record<string, string | undefined> = process.env
): SubscribeRateLimiter | null {
  const url = env.UPSTASH_REDIS_URL
  const token = env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null

  const redis = new Redis({ url, token })
  const ipLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(8, '1 h'),
    prefix: 'newsletter:ip',
  })
  const emailLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 d'),
    prefix: 'newsletter:email',
  })

  return {
    async limitIp(ip: string) {
      const result = await ipLimit.limit(ip || '0.0.0.0')
      return result.success
    },
    async limitEmail(normalizedEmail: string) {
      const key = createHash('sha256').update(normalizedEmail).digest('hex')
      const result = await emailLimit.limit(key)
      return result.success
    },
  }
}

export function newsletterClientIp(req: NextApiRequest): string {
  const headers = req.headers || {}
  const vercel = headerValue(headers['x-vercel-proxied-for'])
  const real = headerValue(headers['x-real-ip'])
  const cf = headerValue(headers['cf-connecting-ip'])
  const forwarded = headerValue(headers['x-forwarded-for'])
  let ip =
    vercel ||
    real ||
    cf ||
    forwarded?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  ip = ip.replace(/:\d+$/, '')
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return ip.toLowerCase()
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed || undefined
}
