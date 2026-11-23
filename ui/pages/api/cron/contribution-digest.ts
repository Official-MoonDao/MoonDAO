import type { NextApiRequest, NextApiResponse } from 'next'
import { runContributionDigest, type DigestKind } from '@/lib/contributions/dailyDigest'
import { getSubmittedFeedContributionsBetween } from '@/lib/contributions/getOnchainContributions'

// Tableland reads, a Groq call (30s timeout) and one Discord post.
export const config = {
  maxDuration: 60,
}

// Called once a day by the "Contribution daily digest" GitHub Actions cron.
// Posts one Discord message summarizing the day's contributions, or a 7-day
// look-back on a quiet day (at most weekly).
//
// Query params:
//   ?dryRun=1             build the message and return it without posting
//   ?force=1              post even if a digest went out in the last 20 hours
//   ?kind=daily|lookback  skip the decision and build that kind
//
// Auth: same shared CRON_SECRET as the other cron routes.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const authHeader = first(req.headers['authorization'])
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const provided = bearerToken || first(req.headers['x-cron-secret']) || first(req.query.secret)
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && provided !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const flag = (name: string) => ['1', 'true'].includes(String(first(req.query[name]) ?? ''))
  const kindParam = first(req.query.kind)
  const kind: DigestKind | undefined =
    kindParam === 'daily' || kindParam === 'lookback' ? kindParam : undefined

  try {
    const result = await runContributionDigest(
      {
        loadEntries: getSubmittedFeedContributionsBetween,
        groqApiKey: process.env.GROQ_API_KEY,
      },
      { dryRun: flag('dryRun'), force: flag('force'), kind }
    )
    return res.status(result.ok ? 200 : 500).json(result)
  } catch (error) {
    console.error('[cron/contribution-digest]', error)
    return res.status(500).json({
      ok: false,
      posted: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
