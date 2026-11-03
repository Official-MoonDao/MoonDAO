import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getCitizensForAuthors,
  getContributionRow,
  rowToFeedContribution,
} from '@/lib/contributions/getOnchainContributions'
import { buildContent, getRedis, postToDiscord } from '@/lib/contributions/notifyNewContributions'
import { isSubmittedOrigin } from '@/lib/contributions/onchain'

// Only fresh rows are announced, so this route can't be used to replay history.
const ANNOUNCE_WINDOW_SECONDS = 24 * 60 * 60
const NOTIFIED_TTL_SECONDS = 30 * 24 * 60 * 60

// Called by the submit form after its row is readable. Replaces the Google Form
// poller for onchain submissions. Anyone may call it: the route reads the row
// from the table itself and announces each ID once, so the caller only chooses
// when, never what.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const id = Number(req.body?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid contribution id.' })
  }

  const row = await getContributionRow(id).catch((err) => {
    console.error('[contributions/notify] row read failed', err)
    return null
  })
  if (!row) return res.status(404).json({ message: 'Contribution not found yet.' })

  const ageSeconds = Date.now() / 1000 - Number(row.createdAt)
  if (
    !isSubmittedOrigin(row.origin) ||
    Number(row.hidden) !== 0 ||
    ageSeconds > ANNOUNCE_WINDOW_SECONDS
  ) {
    return res.status(200).json({ posted: false })
  }

  const redis = getRedis()
  if (!redis) return res.status(503).json({ message: 'Notifications are not configured.' })
  const key = `contributions:onchain:notified:${id}`
  const claimed = await redis.set(key, '1', { nx: true, ex: NOTIFIED_TTL_SECONDS })
  if (claimed !== 'OK') return res.status(200).json({ posted: false, duplicate: true })

  const citizens = await getCitizensForAuthors([row.author])
  const contribution = rowToFeedContribution(row, citizens.get(row.author.toLowerCase()))
  const ok = await postToDiscord(buildContent(contribution))
  if (!ok) {
    // Let a retry claim it again.
    await redis.del(key).catch(() => {})
    return res.status(502).json({ message: 'Could not post to Discord.' })
  }
  return res.status(200).json({ posted: true })
}

export default withMiddleware(handler, rateLimit)
