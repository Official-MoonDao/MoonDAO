import { DEFAULT_CHAIN_V5 } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getCitizensForAuthors,
  getContributionRow,
  rowToFeedContribution,
} from '@/lib/contributions/getOnchainContributions'
import { buildContent, getRedis, postToDiscord } from '@/lib/contributions/notifyNewContributions'
import { contributionsTable, isSubmittedOrigin } from '@/lib/contributions/onchain'
import { getChainSlug } from '@/lib/thirdweb/chain'

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

  const table = contributionsTable(getChainSlug(DEFAULT_CHAIN_V5))
  const redis = getRedis()
  if (!redis || !table)
    return res.status(503).json({ message: 'Notifications are not configured.' })

  // Build the message before taking the lock, so a bad row can't leave it held.
  const citizens = await getCitizensForAuthors([row.author])
  const content = buildContent(rowToFeedContribution(row, citizens.get(row.author.toLowerCase())))

  // Row IDs restart at 1 in every table, and local, preview and production
  // share this Redis, so the key names the table.
  const key = `contributions:onchain:notified:${table.name}:${id}`
  const claimed = await redis.set(key, '1', { nx: true, ex: NOTIFIED_TTL_SECONDS })
  if (claimed !== 'OK') return res.status(200).json({ posted: false, duplicate: true })

  const ok = await postToDiscord(content)
  if (!ok) {
    // Let a retry claim it again.
    await redis.del(key).catch(() => {})
    return res.status(502).json({ message: 'Could not post to Discord.' })
  }
  return res.status(200).json({ posted: true })
}

export default withMiddleware(handler, rateLimit)
