import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

const rateLimitSecond = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(25, '1 s'),
})
const rateLimitMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(500, '1 m'),
})
const rateLimitHour = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2000, '1 h'),
})

function normalizeIp(ip?: string | null): string {
  if (!ip) return '0.0.0.0'
  // strip port
  ip = ip.replace(/:\d+$/, '')
  // IPv4-mapped IPv6 -> plain IPv4
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  // collapse IPv6 uppercase
  return ip.toLowerCase()
}

function getTrustedClientIp(req: NextApiRequest): string {
  const h = req.headers
  const vercel = (h['x-vercel-proxied-for'] as string | undefined)?.trim()
  const real = (h['x-real-ip'] as string | undefined)?.trim()
  const cf = (h['cf-connecting-ip'] as string | undefined)?.trim()

  let ip =
    vercel ||
    real ||
    cf ||
    // As a last resort, take first hop of XFF (may be user-controlled — avoid if possible)
    (h['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '0.0.0.0'

  return normalizeIp(ip)
}

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  if (process.env.NEXT_PUBLIC_ENV !== 'prod') return next()

  // Trusted IP + a stable key that also includes route & method (thwarts trivial IP rotation)
  const ip = getTrustedClientIp(req)
  const path = (req.url || '').split('?')[0] || '/api'
  const method = req.method || 'GET'
  const ua = (req.headers['user-agent'] as string) || ''
  const uaFrag = ua.slice(0, 48)

  const ipKey = `${ip}`
  const routeKey = `${method}:${path}`
  const comboKey = `${ipKey}:${routeKey}:${uaFrag}`

  // short-circuit CORS preflights so they don't count
  if (method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const [sec, min, hour] = await Promise.all([
    rateLimitSecond.limit(`sec:${comboKey}`),
    rateLimitMinute.limit(`min:${comboKey}`),
    rateLimitHour.limit(`hr:${comboKey}`),
  ])

  // Helper to emit consistent 429 with Retry-After
  const deny = (r: { reset: number }, msg: string) => {
    const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.setHeader('X-RateLimit-Reason', msg)
    return res
      .status(429)
      .json({ message: 'Rate limit exceeded', detail: msg, retryAfter })
  }

  if (!sec.success) return deny(sec, 'per-second')
  if (!min.success) return deny(min, 'per-minute')
  if (!hour.success) return deny(hour, 'per-hour')

  res.setHeader('X-RateLimit-Limit-Second', String(sec.limit))
  res.setHeader('X-RateLimit-Remaining-Second', String(sec.remaining))
  res.setHeader('X-RateLimit-Reset-Second', String(sec.reset))
  res.setHeader('X-RateLimit-Limit-Minute', String(min.limit))
  res.setHeader('X-RateLimit-Remaining-Minute', String(min.remaining))
  res.setHeader('X-RateLimit-Reset-Minute', String(min.reset))
  res.setHeader('X-RateLimit-Limit-Hour', String(hour.limit))
  res.setHeader('X-RateLimit-Remaining-Hour', String(hour.remaining))
  res.setHeader('X-RateLimit-Reset-Hour', String(hour.reset))

  return next()
}
