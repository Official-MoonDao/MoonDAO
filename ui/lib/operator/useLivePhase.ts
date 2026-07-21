import { PROJECT_CYCLE } from 'const/config'
import type { ProjectCyclePhase } from 'const/config'
import useSWR from 'swr'
import { getPhaseFlags, type PhaseFlags } from '@/lib/operator/cyclePhase'
import fetcher from '@/lib/swr/fetcher'

type PhaseStatusResponse = {
  livePhase: ProjectCyclePhase
  flags: PhaseFlags
}

/**
 * Client-side live project-cycle phase.
 *
 * Seeds from the deploy-time `PROJECT_CYCLE.phase` defaults, then refreshes
 * from `/api/operator/phase-status` so one-click operator advances propagate
 * without a redeploy. Prefer this over the `IS_*_VOTE` config constants in
 * client components that surface voting CTAs outside `/projects`.
 */
export function useLivePhase() {
  const { data } = useSWR<PhaseStatusResponse>(
    '/api/operator/phase-status',
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60_000,
      errorRetryCount: 1,
      fallbackData: {
        livePhase: PROJECT_CYCLE.phase,
        flags: getPhaseFlags(PROJECT_CYCLE.phase),
      },
    }
  )

  const phase = data?.livePhase ?? PROJECT_CYCLE.phase
  const flags = data?.flags ?? getPhaseFlags(phase)

  return {
    phase,
    isSenateVote: flags.isSenateVote,
    isMemberVote: flags.isMemberVote,
    isRewardsCycle: flags.isRewardsCycle,
  }
}
