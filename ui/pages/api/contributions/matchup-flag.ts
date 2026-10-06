import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getMatchupPool, parseVoterId } from '@/lib/contributions/matchupPool'
import { getMatchupRedis, recordFlag } from '@/lib/contributions/matchupStore'
import { FLAG_REASONS, type FlagReason } from '@/lib/contributions/matchups'

// POST { voter, contributionId, reason } → flag a contribution for Senate review.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { voter: rawVoter, contributionId, reason } = req.body || {}
  const voter = parseVoterId(rawVoter)
  if (!voter) return res.status(400).json({ message: 'Invalid voter id' })
  if (typeof reason !== 'string' || !(reason in FLAG_REASONS)) {
    return res.status(400).json({ message: 'Unknown flag reason' })
  }
  const pool = await getMatchupPool()
  if (typeof contributionId !== 'string' || !pool.some((c) => c.id === contributionId)) {
    return res.status(404).json({ message: 'Contribution not found' })
  }

  const redis = getMatchupRedis()
  if (!redis) {
    return res
      .status(503)
      .json({ message: 'Vote storage is not configured on this deployment.' })
  }

  const result = await recordFlag(redis, voter, contributionId, reason as FlagReason)
  return res.status(200).json(result)
}

export default withMiddleware(handler, rateLimit)
