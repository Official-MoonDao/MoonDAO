/** USD thresholds for “what we unlock” messaging — not on-chain goals. */
export type MissionFundingMilestone = {
  usd: number
  label: string
}

export const MISSION_FUNDING_MILESTONES_USD: Record<number, MissionFundingMilestone[]> = {
  4: [
    { usd: 250_000, label: 'Guaranteed 2nd stratospheric seat' },
    { usd: 500_000, label: 'Virgin Galactic two-seat mission' },
  ],
}

/** USD pledged off-chain but counted toward campaign “raised” in the UI (mission id → USD). */
export const MISSION_OFF_CHAIN_COMMITTED_USD: Partial<Record<number, number>> = {
  4: 111_500,
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
  'Our near-term goal is $250,000 — enough to lock in a guaranteed second stratospheric seat so a community member can fly alongside Frank. Reaching $500,000 unlocks a dedicated two-seat Virgin Galactic mission. Nothing raised in the first round has been spent, and refunds are made available if a seat cannot be secured.'

/**
 * Tagline overrides (mission id → tagline). Takes precedence over the on-chain
 * metadata tagline so the mission page can reflect campaign copy that isn't yet
 * reflected on-chain — currently the Frank re-open for mission 4. Remove a
 * mission's entry once its on-chain metadata is updated so the on-chain value
 * (team-editable via the Edit Mission flow) becomes the source of truth again.
 */
export const MISSION_TAGLINE_OVERRIDES: Partial<Record<number, string>> = {
  4: 'The competition is back on. Every dollar from round one is still held — now we’re raising to send a member of our community to space alongside Frank White.',
}

export function getMissionTagline(
  missionId: unknown,
  onChainTagline: string | undefined | null
): string | undefined {
  const id = Number(missionId)
  if (Number.isFinite(id)) {
    const override = MISSION_TAGLINE_OVERRIDES[id]
    if (typeof override === 'string' && override.trim()) return override
  }
  const normalized =
    typeof onChainTagline === 'string' ? onChainTagline.trim() : undefined
  return normalized || undefined
}

/**
 * Token symbol overrides for missions where the on-chain ERC20 hasn't been deployed via
 * Juicebox yet but the intended symbol is known (e.g. mission 4 / Overview Flight → OVERVIEW).
 */
export const MISSION_TOKEN_SYMBOL_OVERRIDES: Partial<Record<number, string>> = {
  4: 'OVERVIEW',
}

export function getMissionTokenSymbol(
  missionId: unknown,
  onChainSymbol: string | undefined | null
): string | undefined {
  const normalizedOnChainSymbol =
    typeof onChainSymbol === 'string' ? onChainSymbol.trim() : undefined
  if (normalizedOnChainSymbol) return normalizedOnChainSymbol

  if (missionId === undefined || missionId === null) return undefined
  const id = Number(missionId)
  if (!Number.isFinite(id)) return undefined

  const override = MISSION_TOKEN_SYMBOL_OVERRIDES[id]
  const normalizedOverride =
    typeof override === 'string' ? override.trim() : undefined
  return normalizedOverride || undefined
}
