/** USD thresholds for “what we unlock” messaging — not on-chain goals. */
export type MissionFundingMilestone = {
  usd: number
  label: string
}

export const MISSION_FUNDING_MILESTONES_USD: Record<number, MissionFundingMilestone[]> = {
  4: [
    { usd: 500_000, label: 'Stratospheric balloon (+1)' },
    { usd: 1_000_000, label: 'Suborbital seat #1' },
    { usd: 2_000_000, label: 'Suborbital seat #2' },
  ],
}

/** First USD milestone = minimum goal shown in UI for that mission (e.g. mission 4 milestone 1). */
export function getMissionMinimumUsdGoal(missionId: unknown): number | undefined {
  if (missionId === undefined || missionId === null) return undefined
  const id = Number(missionId)
  if (!Number.isFinite(id)) return undefined
  const steps = MISSION_FUNDING_MILESTONES_USD[id]
  return steps?.[0]?.usd
}

export const MISSION_MINIMUM_GOAL_TOOLTIP =
  'This is our minimum goal, if we raise beyond this amount we will expand our ambition to other flight profiles. If we do not achieve our minimum goal refunds will be made available.'
