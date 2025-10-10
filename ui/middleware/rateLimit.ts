import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

const rateLimitSecond = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 s'), // 10 requests per second
})

const rateLimitMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '1 m'), // 300 requests per minute
})

const rateLimitHour = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '1 h'), // 1000 requests per hour
})

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  if (process.env.NEXT_PUBLIC_ENV === 'prod') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const identifier = ip as string

    // Check all rate limits - all must pass
    const [secondCheck, minuteCheck, hourCheck] = await Promise.all([
      rateLimitSecond.limit(`second:${identifier}`),
      rateLimitMinute.limit(`minute:${identifier}`),
      rateLimitHour.limit(`hour:${identifier}`),
    ])

    // If any rate limit is exceeded, return 429
    if (!secondCheck.success) {
      res.status(429).json({
        message: 'Rate limit exceeded: Too many requests per second',
        retryAfter: Math.round(secondCheck.reset / 1000), // seconds until reset
      })
      return
    }

    if (!minuteCheck.success) {
      res.status(429).json({
        message: 'Rate limit exceeded: Too many requests per minute',
        retryAfter: Math.round(minuteCheck.reset / 1000),
      })
      return
    }

    if (!hourCheck.success) {
      res.status(429).json({
        message: 'Rate limit exceeded: Too many requests per hour',
        retryAfter: Math.round(hourCheck.reset / 1000),
      })
      return
    }

    next()
  } else {
    next()
  }
}
