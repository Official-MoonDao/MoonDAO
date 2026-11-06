import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import type { NextApiRequest, NextApiResponse } from 'next'
import { collectFeedItems } from '@/lib/activity-feed/collectFeedItems'
import { buildActivityRssXml, feedItemsFromUpdates } from '@/lib/activity-feed/rss'
import { listUpdates } from '@/lib/updates/loadUpdates'

// Collecting reads several sources, each capped at 8s (mint times at 15s).
export const config = {
  maxDuration: 60,
}

// A malformed post shouldn't take the activity items down with it.
function updateItems() {
  try {
    return feedItemsFromUpdates(listUpdates())
  } catch (error) {
    console.error('[updates-rss] could not load updates:', error)
    return []
  }
}

// Served at /updates/rss.xml (see the rewrite in next.config.js). The feed is
// built on request and cached at the CDN for an hour, so it fills itself as
// activity happens: no cron or build step is needed. Not rate limited, since
// feed readers poll from shared IPs and the CDN absorbs repeat requests.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const now = new Date()
    const items = [...(await collectFeedItems(now)), ...updateItems()]
    setCDNCacheHeaders(res, 3600, 86400)
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    return res.status(200).send(buildActivityRssXml(items, { now }))
  } catch (error) {
    console.error('[updates-rss]', error)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).json({ message: 'Failed to build feed' })
  }
}
