import { DEFAULT_CHAIN_V5 } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { statement } = req.query

  const data = await queryTable(DEFAULT_CHAIN_V5, statement as string)

  if (!data) {
    return res.status(500).json({ message: 'Error querying tableland table' })
  }

  return res.status(200).json(data)
}

export default handler
