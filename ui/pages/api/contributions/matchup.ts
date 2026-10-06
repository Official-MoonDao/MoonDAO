import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getMatchupAuthors,
  type MatchupAuthor,
} from '@/lib/contributions/matchupAuthors'
import { getMatchupPool, parseVoterId } from '@/lib/contributions/matchupPool'
import {
  getMatchupRedis,
  getMatchupStats,
  getVoterState,
  issueMatchup,
  recordPick,
} from '@/lib/contributions/matchupStore'
import {
  eligibleCards,
  MAX_VOTES_PER_DAY,
  pickPair,
  type MatchupCard,
} from '@/lib/contributions/matchups'

export type MatchupResponse = {
  /** Null when votes can't be saved (storage not configured). */
  matchupId: string | null
  cards: [MatchupCard, MatchupCard] | null
  poolSize: number
  votesToday: number
  maxVotesPerDay: number
  storage: boolean
}

export type PickResponse = {
  votesToday: number
  /** Authors of both contributions, keyed by id; only sent after a counted pick. */
  authors: Record<string, MatchupAuthor> | null
}

// GET  ?voter=<id>  → a fresh pair of contributions to compare
// POST { voter, matchupId, winnerId, ignoreDailyLimit? } → record the pick.
//      winnerId is a contribution id, 'neither' (both lose) or null (skip).
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const voter = parseVoterId(req.query.voter)
    if (!voter) return res.status(400).json({ message: 'Invalid voter id' })

    const redis = getMatchupRedis()
    const pool = await getMatchupPool()
    // A wallet voter never sees their own submissions.
    const cards = eligibleCards(pool, {
      excludeWallet: voter.startsWith('0x') ? voter : undefined,
    })

    const [stats, voterState] = redis
      ? await Promise.all([getMatchupStats(redis), getVoterState(redis, voter)])
      : [{ wins: {}, matchups: {} }, { judgedPairs: new Set<string>(), votesToday: 0 }]

    const pair = pickPair(cards, stats.matchups, voterState.judgedPairs)
    const matchupId =
      pair && redis ? await issueMatchup(redis, voter, pair[0].id, pair[1].id) : null

    const body: MatchupResponse = {
      matchupId,
      cards: pair,
      poolSize: cards.length,
      votesToday: voterState.votesToday,
      maxVotesPerDay: MAX_VOTES_PER_DAY,
      storage: !!redis,
    }
    return res.status(200).json(body)
  }

  if (req.method === 'POST') {
    const { voter: rawVoter, matchupId, winnerId, ignoreDailyLimit } =
      req.body || {}
    const voter = parseVoterId(rawVoter)
    if (!voter) return res.status(400).json({ message: 'Invalid voter id' })
    if (typeof matchupId !== 'string' || !matchupId) {
      return res.status(400).json({ message: 'Missing matchupId' })
    }
    if (winnerId !== null && typeof winnerId !== 'string') {
      return res
        .status(400)
        .json({ message: "winnerId must be a contribution id, 'neither' or null" })
    }

    const redis = getMatchupRedis()
    if (!redis) {
      return res
        .status(503)
        .json({ message: 'Vote storage is not configured on this deployment.' })
    }

    const result = await recordPick(redis, voter, matchupId, winnerId, {
      ignoreDailyLimit: ignoreDailyLimit === true,
    })
    if (!result.ok) return res.status(result.status).json({ message: result.message })

    // Reveal who did the work only once the pick is saved (not on a skip).
    let authors: PickResponse['authors'] = null
    if (winnerId !== null) {
      const pool = await getMatchupPool()
      const pair = pool.filter((c) => result.contributionIds.includes(c.id))
      authors = await getMatchupAuthors(pair)
    }
    const body: PickResponse = { votesToday: result.votesToday, authors }
    return res.status(200).json(body)
  }

  return res.status(405).json({ message: 'Method not allowed' })
}

export default withMiddleware(handler, rateLimit)
