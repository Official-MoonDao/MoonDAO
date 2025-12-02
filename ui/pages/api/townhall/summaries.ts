import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSummaries } from '../../../lib/townhall/summaries'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0
    const search = req.query.search as string | undefined

    console.log(`[townhall/summaries] Fetching summaries with limit: ${limit}, offset: ${offset}, search: ${search || 'none'}`)

    const result = await getSummaries({ limit, offset, search })

    console.log(
      `[townhall/summaries] Found ${result.summaries.length} summaries out of ${result.total} total`
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching town hall summaries:', error)
    return res.status(500).json({
      message: 'Failed to fetch summaries',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)
