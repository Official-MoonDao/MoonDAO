import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { publicHeadersMiddleware } from 'middleware/publicHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parseBookParams } from '@/lib/forecasts/bookParams'
import { crowdAggregate } from '@/lib/forecasts/brier'
import { privyUserIdFromRequest } from '@/lib/forecasts/identity'
import { UnknownForecastSchemaError } from '@/lib/forecasts/schema'
import { getForecastRedis, listBookUsers, readLatest } from '@/lib/forecasts/store'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const book = parseBookParams(req.query)
  if (!book.ok) return res.status(400).json({ error: book.error })

  const redis = getForecastRedis()
  if (!redis) return res.status(503).json({ error: 'store-unavailable' })

  setCDNCacheHeaders(res, 60, 60)

  let excludeUserId: string | undefined
  if (req.query.excludeMe === '1') {
    excludeUserId = (await privyUserIdFromRequest(req)) ?? undefined
  }

  try {
    const userIds = await listBookUsers(redis, book.chainSlug, book.deprizeId)
    const latestByUser: Array<{ userId: string; vector: number[] }> = []
    for (const userId of userIds) {
      const latest = await readLatest(redis, book.chainSlug, book.deprizeId, userId)
      if (latest) latestByUser.push({ userId, vector: latest.vector })
    }
    const aggregate = crowdAggregate(latestByUser, excludeUserId)
    return res.status(200).json({
      ...aggregate,
      staleSeconds: 60,
    })
  } catch (err) {
    if (err instanceof UnknownForecastSchemaError) {
      return res.status(409).json({ error: 'unknown-schema' })
    }
    throw err
  }
}

export default withMiddleware(handler, publicHeadersMiddleware, rateLimit)
