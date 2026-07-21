import { PROJECT_CYCLE } from 'const/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getLivePhaseOverride,
  getNextPhase,
  getPhaseFlags,
  resolveLivePhase,
  resolveMemberVoteSubmissionsOpen,
} from '@/lib/operator/cyclePhase'

// Public read of the current project-cycle phase. Returns the deploy-time
// default (PROJECT_CYCLE.phase), the live override (if any), and the resolved
// effective phase + its boolean flags. Unauthenticated on purpose: the phase
// is already visible from the /projects UI, and both the projects page
// (getStaticProps) and the operator panel poll this to stay in sync without a
// redeploy. All mutation goes through the operator-gated /advance-phase route.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const override = await getLivePhaseOverride()
  const phase = resolveLivePhase(override)

  return res.status(200).json({
    configPhase: PROJECT_CYCLE.phase,
    livePhase: phase,
    override,
    nextPhase: getNextPhase(phase),
    flags: getPhaseFlags(phase),
    memberVoteSubmissionsOpen: resolveMemberVoteSubmissionsOpen(
      phase,
      override
    ),
    quarter: PROJECT_CYCLE.quarter,
    year: PROJECT_CYCLE.year,
  })
}
