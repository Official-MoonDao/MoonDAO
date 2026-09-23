import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { publicHeadersMiddleware } from 'middleware/publicHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchForecastConsensus } from '@/lib/deprize/fetchForecastConsensus'
import { parseBookParams } from '@/lib/forecasts/bookParams'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const book = parseBookParams(req.query)
  if (!book.ok) return res.status(400).json({ error: book.error })

  const outcomes = Number(req.query.outcomes)
  if (!Number.isInteger(outcomes) || outcomes < 2) {
    return res.status(400).json({ error: 'missing-outcomes' })
  }

  let resolvedVector: number[] | null = null
  if (typeof req.query.resolved === 'string' && req.query.resolved.length > 0) {
    try {
      const parsed = JSON.parse(req.query.resolved)
      if (Array.isArray(parsed) && parsed.length === outcomes) {
        resolvedVector = parsed.map((value) => Number(value))
      }
    } catch {
      resolvedVector = null
    }
  }

  setCDNCacheHeaders(res, 60, 60)

  const consensus = await fetchForecastConsensus({
    chainSlug: book.chainSlug,
    deprizeId: book.deprizeId,
    outcomeCount: outcomes,
    resolvedVector,
  })
  return res.status(200).json(consensus)
}

export default withMiddleware(handler, publicHeadersMiddleware, rateLimit)
