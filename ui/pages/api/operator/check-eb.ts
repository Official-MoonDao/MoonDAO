import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  return res.status(200).json({ isOperator: true })
}

// Gated by a hard-coded allowlist (`OPERATORS` in `const/config.ts`).
export default withMiddleware(handler, isOperator)
