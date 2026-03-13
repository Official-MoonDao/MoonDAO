import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

const ALLOWED_PATHS = ['/overview-delegate']

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { path } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ message: 'Path parameter is required' })
  }

  if (!ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ message: 'Invalid path' })
  }

  try {
    await res.revalidate(path)
    return res.json({ revalidated: true })
  } catch {
    return res.status(500).json({ message: 'Error revalidating' })
  }
}

export default withMiddleware(handler, rateLimit)
