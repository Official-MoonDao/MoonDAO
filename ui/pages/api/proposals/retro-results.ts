/**
 * Read-only Retroactive Rewards results.
 *
 * Returns the same per-project pool shares the on-chain retro tally
 * would produce, without doing any writes. Used by the `/projects`
 * Retroactive Rewards tab to render a ranked list (% of pool, ETH/USDC
 * + MOONEY shares) — works as both a live preview during the rewards
 * cycle and a permanent record once the cycle has closed.
 *
 * GET only. Quarter/year default to the previous calendar quarter
 * (the one whose projects are typically being retro-tallied right now),
 * but can be overridden via `?quarter=&year=` for backfills / audits.
 */
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getRelativeQuarter } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { computeRetroactiveOutcome } from '@/lib/proposals/computeRetroactiveOutcome'

const chain = DEFAULT_CHAIN_V5

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Default to the *previous* calendar quarter — that's the cohort
  // currently in the retro-distribution window. The member-vote results
  // endpoint defaults to the current quarter because that's the cycle
  // being voted on; for retros the cycle being voted on belongs to the
  // prior quarter. Override with `?quarter=&year=` for older audits.
  const fallback = getRelativeQuarter(-1)
  const quarter = req.query.quarter ? Number(req.query.quarter) : fallback.quarter
  const year = req.query.year ? Number(req.query.year) : fallback.year

  try {
    const outcome = await computeRetroactiveOutcome({ chain, quarter, year })

    // Cache at the edge briefly. The underlying computation is heavy
    // (Tableland + multi-chain RPC + per-voter citizen probes +
    // vMOONEY snapshot) but the result is deterministic for a given
    // (quarter, year, vote-set), so a short shared cache with
    // stale-while-revalidate keeps the panel snappy without serving
    // wildly stale numbers. The `outcome: null` case (no eligible
    // projects, no votes, etc.) is just as expensive to re-derive as
    // the populated one — every traffic spike pre-vote would otherwise
    // re-run the full pipeline — so it gets the same cache treatment.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    )
    return res.status(200).json({ outcome: outcome ?? null, quarter, year })
  } catch (error: any) {
    console.error('[retro-results] computeRetroactiveOutcome failed:', error)
    return res
      .status(500)
      .json({ error: error?.message || 'Failed to compute retro results' })
  }
}

export default withMiddleware(handler, rateLimit)
