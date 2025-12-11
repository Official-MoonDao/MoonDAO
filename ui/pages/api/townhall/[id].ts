import type { NextApiRequest, NextApiResponse } from 'next'
import { getBroadcastById } from '../../../lib/townhall/convertkit'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid broadcast ID' })
    }

    const broadcast = await getBroadcastById(id)

    if (!broadcast) {
      return res.status(404).json({ message: 'Summary not found' })
    }

    return res.status(200).json({
      id: broadcast.id,
      title: broadcast.subject,
      content: broadcast.content,
      publishedAt: broadcast.published_at || broadcast.created_at,
      url: broadcast.public_url,
      createdAt: broadcast.created_at,
    })
  } catch (error) {
    console.error('Error fetching town hall summary:', error)
    return res.status(500).json({
      message: 'Failed to fetch summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)

