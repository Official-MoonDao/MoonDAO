import { DEFAULT_CHAIN_V5 } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { setCDNCacheHeaders } from '@/lib/cache/cacheHeaders'
import queryTable from '@/lib/tableland/queryTable'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { statement } = req.query

  if (!statement || typeof statement !== 'string') {
    return res.status(400).json({ error: 'Statement parameter is required' })
  }

  // Cache varies by SQL statement (different queries = different cache keys)
  setCDNCacheHeaders(res, 30, 60, 'Accept-Encoding, statement')

  const data = await queryTable(DEFAULT_CHAIN_V5, statement as string)

  if (!data) {
    return res.status(500).json({ message: 'Error querying tableland table' })
  }

  return res.status(200).json(data)
}

export default withMiddleware(handler, rateLimit)
