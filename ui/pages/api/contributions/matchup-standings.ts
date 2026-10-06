import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getMatchupPool } from '@/lib/contributions/matchupPool'
import { getMatchupRedis, getMatchupStats } from '@/lib/contributions/matchupStore'
import {
  computeStandings,
  eligibleCards,
  MIN_MATCHUPS_FOR_PAYOUT,
  PAYOUT_CUTOFF_FRACTION,
  type Standing,
} from '@/lib/contributions/matchups'

export type StandingsResponse = {
  standings: Standing[]
  totalPicks: number
  minMatchups: number
  cutoffFraction: number
  storage: boolean
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const redis = getMatchupRedis()
  const [pool, stats] = await Promise.all([
    getMatchupPool(),
    redis ? getMatchupStats(redis) : Promise.resolve({ wins: {}, matchups: {} }),
  ])
  const standings = computeStandings(eligibleCards(pool), stats)
  // Each pick adds one win, so total wins across the pool is the pick count.
  const totalPicks = Object.values(stats.wins).reduce((sum, n) => sum + n, 0)

  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60')
  const body: StandingsResponse = {
    standings,
    totalPicks,
    minMatchups: MIN_MATCHUPS_FOR_PAYOUT,
    cutoffFraction: PAYOUT_CUTOFF_FRACTION,
    storage: !!redis,
  }
  return res.status(200).json(body)
}

export default withMiddleware(handler, rateLimit)
