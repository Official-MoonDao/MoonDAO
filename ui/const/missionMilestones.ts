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

/** USD pledged off-chain but counted toward campaign “raised” in the UI (mission id → USD). */
export const MISSION_OFF_CHAIN_COMMITTED_USD: Partial<Record<number, number>> = {
  4: 100_000,
}

export function getMissionOffChainCommittedUsd(missionId: unknown): number {
  if (missionId === undefined || missionId === null) return 0
  const id = Number(missionId)
  if (!Number.isFinite(id)) return 0
  const v = MISSION_OFF_CHAIN_COMMITTED_USD[id]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
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
