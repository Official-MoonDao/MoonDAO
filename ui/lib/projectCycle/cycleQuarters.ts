import { PROJECT_CYCLE } from 'const/config'
import type { ProjectCyclePhase } from 'const/config'

/**
 * Cycle-quarter math derived from `PROJECT_CYCLE`, never `new Date()`.
 *
 * The proposal slate, member-vote tally, retro cohort, and new-proposal
 * tagging all used to pick their own calendar clock. These helpers are the
 * single source those call sites should share.
 */

export type CycleQuarter = { quarter: number; year: number }

export function shiftQuarter(
  { quarter, year }: CycleQuarter,
  offset: number
): CycleQuarter {
  const zeroBased = quarter - 1 + offset
  return {
    quarter: ((zeroBased % 4) + 4) % 4 + 1,
    year: year + Math.floor(zeroBased / 4),
  }
}

export function getProposalCycle(): CycleQuarter {
  return { quarter: PROJECT_CYCLE.quarter, year: PROJECT_CYCLE.year }
}

export function getRetroCohort(from: CycleQuarter = getProposalCycle()): CycleQuarter {
  return shiftQuarter(from, -1)
}

export function getSubmissionTargetCycle(
  phase: ProjectCyclePhase,
  from: CycleQuarter = getProposalCycle()
): CycleQuarter {
  return phase === 'intake' ? from : shiftQuarter(from, 1)
}
