/**
 * Read-only Member Vote results.
 *
 * Returns the same outcome the on-chain tally (`POST /api/proposals/vote`)
 * would produce, without doing any writes or the multisig audit. Used by the
 * `/projects` page to display percentages + approval status post-vote (and
 * as a live preview during voting).
 *
 * GET only. Quarter/year default to the current calendar quarter, but can
 * be overridden via `?quarter=&year=` for backfills / debugging.
 */
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getCurrentQuarter } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { computeMemberVoteOutcome } from '@/lib/proposals/computeMemberVoteOutcome'

const chain = DEFAULT_CHAIN_V5

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const current = getCurrentQuarter()
  const quarter = req.query.quarter
    ? Number(req.query.quarter)
    : current.quarter
  const year = req.query.year ? Number(req.query.year) : current.year

  try {
    const outcome = await computeMemberVoteOutcome({ chain, quarter, year })
    if (!outcome) {
      return res.status(200).json({ outcome: null, quarter, year })
    }

    // Cache at the edge briefly. The underlying computation is heavy
    // (Tableland + multi-chain RPC + IPFS + vMOONEY snapshot) but the
    // result is deterministic for a given (quarter, year, vote-set), so a
    // short shared cache with stale-while-revalidate keeps the page snappy
    // without serving wildly stale numbers.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    )
    return res.status(200).json({ outcome, quarter, year })
  } catch (error: any) {
    console.error('[vote-results] computeMemberVoteOutcome failed:', error)
    return res
      .status(500)
      .json({ error: error?.message || 'Failed to compute member vote results' })
  }
}

export default withMiddleware(handler, rateLimit)
