import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { collectActivity } from '@/lib/activity-summary/collectActivity'
import { generateActivitySummary } from '@/lib/activity-summary/generate'
import { hasActivity } from '@/lib/activity-summary/prompt'
import { getOrCreateSummary, getSummaryRedis } from '@/lib/activity-summary/store'

// A cache miss collects ~10 sources (each capped at 8s) and then waits on
// Groq, which can outlast the default serverless limit.
export const config = {
  maxDuration: 60,
}

// Weekly AI summary of MoonDAO activity for the citizen dashboard. Generated
// at most once per UTC day and stored in Redis; see lib/activity-summary/store.
// The data it summarizes is already public, so the route is not gated; the
// card that renders it only appears on the citizen dashboard.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY

  try {
    const result = await getOrCreateSummary({
      store: getSummaryRedis(),
      generate: async () => {
        if (!apiKey) return null
        const snapshot = await collectActivity()
        if (!hasActivity(snapshot)) return null
        const outcome = await generateActivitySummary({ snapshot, apiKey })
        if (!outcome.ok) {
          console.error('[activity-summary] generation failed:', outcome.error)
          return null
        }
        return outcome.summary
      },
    })

    if (!result.summary) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(503).json({ message: 'Activity summary unavailable' })
    }

    // A fallback means today's generation hasn't succeeded yet, so let the
    // CDN retry sooner.
    if (result.source === 'fallback') setCDNCacheHeaders(res, 600, 3600)
    else setCDNCacheHeaders(res, 3600, 86400)

    return res.status(200).json(result.summary)
  } catch (error) {
    console.error('[activity-summary]', error)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).json({ message: 'Failed to load activity summary' })
  }
}

export default withMiddleware(handler, rateLimit)
