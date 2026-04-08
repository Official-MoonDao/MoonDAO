export type MissionContributorTier = {
  amountUsd: number
  title: string
  description: string
}

/** Per-mission supporter perk levels shown in the contribute modal (not enforced on-chain). */
export const MISSION_CONTRIBUTOR_TIERS: Partial<Record<number, MissionContributorTier[]>> = {
  4: [
    {
      amountUsd: 100,
      title: 'Overview Crew',
      description:
        'Free Citizenship (required to enter into the competition to fly with Frank).',
    },
    {
      amountUsd: 1_000,
      title: 'Horizon Collector',
      description: 'Signed copy of the 4th edition of The Overview Effect.',
    },
    {
      amountUsd: 10_000,
      title: 'Kármán Circle',
      description:
        'Private virtual briefing with Frank White and the mission team, public supporter recognition, and insider updates at major milestones. Details coordinated after your contribution.',
    },
  ],
}

export function getMissionContributorTiers(missionId: unknown): MissionContributorTier[] {
  if (missionId === undefined || missionId === null) return []
  const id = Number(missionId)
  if (!Number.isFinite(id)) return []
  return MISSION_CONTRIBUTOR_TIERS[id] ?? []
}
