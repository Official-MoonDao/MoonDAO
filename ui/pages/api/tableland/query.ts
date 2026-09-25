import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'
import { resolveTablelandQueryChain } from '@/lib/tableland/resolveQueryChain'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { statement, chain: chainParam } = req.query

  if (!statement || typeof statement !== 'string') {
    return res.status(400).json({ error: 'Statement parameter is required' })
  }

  if (Array.isArray(chainParam)) {
    return res.status(400).json({ error: 'Unknown chain' })
  }

  const resolved = resolveTablelandQueryChain(chainParam)
  if (!resolved.ok) {
    return res.status(400).json({ error: 'Unknown chain' })
  }

  // Cache varies by SQL statement (different queries = different cache keys)
  setCDNCacheHeaders(res, 30, 60, 'Accept-Encoding, statement')

  const data = await queryTable(resolved.chain, statement)

  if (!data) {
    return res.status(500).json({ message: 'Error querying tableland table' })
  }

  return res.status(200).json(data)
}

export default withMiddleware(handler, rateLimit)
