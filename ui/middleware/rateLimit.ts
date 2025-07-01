import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 s'), // 5 requests per second
})

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  if (process.env.NEXT_PUBLIC_ENV === 'prod') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const { success } = await ratelimit.limit(ip as string)

    if (success) {
      next()
    } else {
      res.status(429).json({ message: 'Rate limit exceeded' })
    }
  } else {
    next()
  }
}
