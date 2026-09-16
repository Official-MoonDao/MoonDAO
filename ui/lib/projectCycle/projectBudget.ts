/**
 * MDP-267 Project System v9.0 — pot, grant cap, and cycle versioning.
 *
 * Pot = 3% of official liquid AUM (designated treasury Safes + Uniswap V3
 * WETH side; exclude MOONEY and staked ETH), priced at midnight UTC on the
 * first day of the quarter, rounded to the nearest $500.
 *
 * v9 applies from Q4 2026. Earlier cycles stay on v8 (top 50% + 3/4 knapsack).
 */

export const PROJECT_POT_AUM_RATE = 0.03
export const PROJECT_GRANT_POT_SHARE = 0.25
export const PROJECT_COMMUNITY_POT_SHARE = 0.1
export const PROJECT_POT_ROUND_USD = 500

/** First cycle that executes under MDP-267. */
export const V9_START = { year: 2026, quarter: 4 } as const

export type ProjectFundingRules = 'v8' | 'v9'

/**
 * Closed-cycle pots. Used so historical audits keep the pot and rules they
 * actually ran under, instead of inheriting the live `PROJECT_CYCLE.budgetUSD`.
 */
export const HISTORICAL_PROJECT_POT_USD: Record<string, number> = {
  '2026-2': 23409,
  '2026-3': 24310,
}

export function cycleKey(quarter: number, year: number): string {
  return `${year}-${quarter}`
}

export function projectFundingRulesForCycle(
  quarter: number,
  year: number
): ProjectFundingRules {
  if (year > V9_START.year) return 'v9'
  if (year === V9_START.year && quarter >= V9_START.quarter) return 'v9'
  return 'v8'
}

export function roundToNearest500(amountUSD: number): number {
  if (!Number.isFinite(amountUSD)) return 0
  return Math.round(amountUSD / PROJECT_POT_ROUND_USD) * PROJECT_POT_ROUND_USD
}

export function projectPotFromOfficialAum(officialLiquidAumUSD: number): number {
  return roundToNearest500(officialLiquidAumUSD * PROJECT_POT_AUM_RATE)
}

export function projectGrantCapUSD(potUSD: number): number {
  if (!Number.isFinite(potUSD) || potUSD <= 0) return 0
  return Math.round(potUSD * PROJECT_GRANT_POT_SHARE)
}

export function projectGrantUSD(
  askUSD: number,
  potUSD: number,
  rules: ProjectFundingRules = 'v9'
): number {
  const ask = Number.isFinite(askUSD) && askUSD > 0 ? askUSD : 0
  if (rules === 'v8') return ask
  return Math.min(ask, projectGrantCapUSD(potUSD))
}

export function communityCircleUSD(potUSD: number): number {
  if (!Number.isFinite(potUSD) || potUSD <= 0) return 0
  return Math.round(potUSD * PROJECT_COMMUNITY_POT_SHARE)
}

/** Retro leftover after the funded grants and the 10% community slice. */
export function retroPoolUSD(potUSD: number, grantTotalUSD: number): number {
  const community = communityCircleUSD(potUSD)
  const leftover = potUSD - grantTotalUSD - community
  return leftover > 0 ? leftover : 0
}

export function projectPotForCycle(
  quarter: number,
  year: number,
  currentCyclePotUSD: number
): number {
  const historical = HISTORICAL_PROJECT_POT_USD[cycleKey(quarter, year)]
  if (historical != null) return historical
  return currentCyclePotUSD
}
