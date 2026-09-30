import { projectById, SEED_ATLAS } from '@/lib/lunar-atlas'
import type { DePrizeRaceOutcome } from '@/lib/deprize/competitions'

/** Name shown on executive resolve controls. Vehicle label when we have one. */
export function outcomeWinnerName(
  outcome: DePrizeRaceOutcome | undefined,
  index: number
): string {
  if (outcome?.field) return 'Open Field'
  if (outcome?.vehicleLabel) return outcome.vehicleLabel
  if (outcome?.projectId) {
    const project = projectById(SEED_ATLAS, outcome.projectId)
    if (project?.name) return project.name
  }
  return `Outcome ${index + 1}`
}

export function outcomeWinnerNameAt(
  outcomes: readonly DePrizeRaceOutcome[] | undefined,
  teamIds: readonly bigint[],
  index: number
): string {
  const teamId = teamIds[index]
  const byTeam =
    teamId != null
      ? outcomes?.find((outcome) => outcome.teamId != null && BigInt(outcome.teamId) === teamId)
      : undefined
  return outcomeWinnerName(byTeam ?? outcomes?.[index], index)
}
