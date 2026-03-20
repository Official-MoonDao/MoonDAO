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
