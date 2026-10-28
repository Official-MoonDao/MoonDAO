/**
 * Read-only Member Vote audit data.
 *
 * Same compute as `/api/proposals/vote-results` but with the per-voter and
 * per-project breakdown (`outcome.audit`) attached. Powers the public
 * `/projects/audit` page so anyone can verify the tally without rerunning
 * the standalone `audit-q2-2026-votes.mjs` script.
 *
 * GET only. Quarter/year default to the live proposal cycle
 * (`PROJECT_CYCLE`), but can be overridden via `?quarter=&year=` for
 * past-quarter audits.
 *
 * While the live cycle's Member Vote submissions are still open, the
 * response is sealed: no per-voter ballots and no running tally. Past
 * quarters are unaffected.
 */
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  getLivePhaseOverride,
  resolveLivePhase,
  resolveMemberVoteSubmissionsOpen,
} from '@/lib/operator/cyclePhase'
import { getProposalCycle } from '@/lib/projectCycle/cycleQuarters'
import { computeMemberVoteOutcome } from '@/lib/proposals/computeMemberVoteOutcome'
import { loadMemberVoteAudit } from '@/lib/proposals/memberVoteAuditSeal'

const chain = DEFAULT_CHAIN_V5

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const current = getProposalCycle()
  const quarter = req.query.quarter ? Number(req.query.quarter) : current.quarter
  const year = req.query.year ? Number(req.query.year) : current.year

  try {
    const override = await getLivePhaseOverride()
    const submissionsOpen = resolveMemberVoteSubmissionsOpen(resolveLivePhase(override), override)
    const payload = await loadMemberVoteAudit({
      quarter,
      year,
      cycleQuarter: current.quarter,
      cycleYear: current.year,
      memberVoteSubmissionsOpen: submissionsOpen,
      compute: () =>
        computeMemberVoteOutcome({
          chain,
          quarter,
          year,
          includeAudit: true,
        }),
    })

    // Sealed responses stay fresh so the breakdown appears soon after
    // submissions close. A published tally is cached longer: it is larger
    // but identical for the same (quarter, year, vote-set), and the page
    // is for occasional verification rather than frequent polling.
    res.setHeader(
      'Cache-Control',
      payload.sealed
        ? 'public, s-maxage=30, stale-while-revalidate=60'
        : 'public, s-maxage=300, stale-while-revalidate=900'
    )
    return res.status(200).json(payload)
  } catch (error: any) {
    console.error('[vote-audit] computeMemberVoteOutcome failed:', error)
    return res.status(500).json({ error: error?.message || 'Failed to compute member vote audit' })
  }
}

export default withMiddleware(handler, rateLimit)
