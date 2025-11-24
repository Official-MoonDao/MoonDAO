import type { NextApiRequest, NextApiResponse } from 'next'
import { getTownHallBroadcasts } from '../../../lib/townhall/convertkit'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const tagId = process.env.TOWNHALL_CONVERTKIT_TAG_ID
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    const broadcasts = await getTownHallBroadcasts(tagId)

    const filteredBroadcasts = broadcasts
      .filter((broadcast) => broadcast.public)
      .sort((a, b) => {
        const dateA = new Date(a.published_at || a.created_at || 0).getTime()
        const dateB = new Date(b.published_at || b.created_at || 0).getTime()
        return dateB - dateA
      })
      .slice(offset, offset + limit)

    const summaries = filteredBroadcasts.map((broadcast) => ({
      id: broadcast.id,
      title: broadcast.subject,
      content: broadcast.content,
      publishedAt: broadcast.published_at || broadcast.created_at,
      url: broadcast.public_url,
      createdAt: broadcast.created_at,
    }))

    return res.status(200).json({
      summaries,
      total: filteredBroadcasts.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching town hall summaries:', error)
    return res.status(500).json({
      message: 'Failed to fetch summaries',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)

