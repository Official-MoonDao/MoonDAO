/**
 * Read-only Retroactive Rewards audit data.
 *
 * Same compute as `/api/proposals/retro-results` but with the
 * per-voter and per-project breakdown (`outcome.audit`) attached.
 * Powers the public `/projects/retro-audit` page so anyone can
 * verify the retro tally — voters and their voting power, every
 * project's citizen supporters (raw → normalized → weighted), and
 * the resulting per-project pool share — without rerunning the
 * tally locally.
 *
 * GET only. Quarter/year default to the previous calendar quarter
 * (matches `/api/proposals/retro-results`); override with
 * `?quarter=&year=` for older cycles.
 */
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getRelativeQuarter } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { computeRetroactiveOutcome } from '@/lib/proposals/computeRetroactiveOutcome'
import { parseCycleParams } from '@/lib/proposals/parseCycleParams'

const chain = DEFAULT_CHAIN_V5

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const fallback = getRelativeQuarter(-1)
  const parsed = parseCycleParams(req, fallback)
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error })
  }
  const { quarter, year } = parsed.params

  try {
    const outcome = await computeRetroactiveOutcome({
      chain,
      quarter,
      year,
      includeAudit: true,
    })

    // Cache more aggressively than `/retro-results`. The audit payload
    // is larger but identical for the same (quarter, year, vote-set),
    // and the page is meant for occasional verification rather than
    // frequent polling — a 5min shared cache keeps repeat visits cheap.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=900'
    )
    return res.status(200).json({ outcome: outcome ?? null, quarter, year })
  } catch (error: any) {
    console.error('[retro-audit] computeRetroactiveOutcome failed:', error)
    return res
      .status(500)
      .json({ error: error?.message || 'Failed to compute retro audit' })
  }
}

export default withMiddleware(handler, rateLimit)
