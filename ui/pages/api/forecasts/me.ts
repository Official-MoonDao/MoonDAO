import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { privyUserIdFromRequest } from '@/lib/forecasts/identity'
import { eraseUser, getForecastRedis } from '@/lib/forecasts/store'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await privyUserIdFromRequest(req)
  if (!userId) return res.status(401).json({ error: 'unauthorized' })

  const redis = getForecastRedis()
  if (!redis) return res.status(503).json({ error: 'store-unavailable' })

  await eraseUser(redis, userId)
  return res.status(204).end()
}

export default withMiddleware(handler, authMiddleware, rateLimit)
