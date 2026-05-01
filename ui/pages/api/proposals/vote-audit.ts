/**
 * Read-only Member Vote audit data.
 *
 * Same compute as `/api/proposals/vote-results` but with the per-voter and
 * per-project breakdown (`outcome.audit`) attached. Powers the public
 * `/projects/audit` page so anyone can verify the tally without rerunning
 * the standalone `audit-q2-2026-votes.mjs` script.
 *
 * GET only. Quarter/year default to the current calendar quarter, but can
 * be overridden via `?quarter=&year=` for past-quarter audits.
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
    const outcome = await computeMemberVoteOutcome({
      chain,
      quarter,
      year,
      includeAudit: true,
    })

    // Cache more aggressively than `/vote-results`. The audit payload is
    // larger but identical for the same (quarter, year, vote-set), and
    // the page is meant for occasional verification rather than frequent
    // polling — a 5min shared cache keeps repeat visits cheap.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=900'
    )
    return res.status(200).json({ outcome: outcome ?? null, quarter, year })
  } catch (error: any) {
    console.error('[vote-audit] computeMemberVoteOutcome failed:', error)
    return res
      .status(500)
      .json({ error: error?.message || 'Failed to compute member vote audit' })
  }
}

export default withMiddleware(handler, rateLimit)
