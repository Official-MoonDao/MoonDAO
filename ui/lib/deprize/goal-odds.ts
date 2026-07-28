/**
 * Pure LMSR-index → atlas projectId odds mapping.
 *
 * useDePrizeMarket returns `probability` as a percent (0–100). Moon Base Zero
 * `SharedGoalMarket.impliedOdds` is fractions of 1. This module is the only
 * place that conversion happens — keep it dependency-free for yarn test:deprize.
 */

export type GoalOddsOutcome = {
  projectId: string
  /** When set, must equal teamIds[i] or the mapper returns undefined. */
  teamId?: number
}

/**
 * Map LMSR outcome probabilities onto atlas project ids.
 *
 * Returns fractions of 1, drops non-finite entries, and returns `undefined` on
 * any length mismatch or teamId checksum failure. Blank is recoverable; wrong
 * attribution (Lockheed's odds on Westinghouse) is not.
 *
 * Also returns `undefined` when no finite odds survive — a loading or closed
 * market reads all-NaN, and an empty map would let a merge overwrite curator
 * priors with nothing.
 */
export function mapOutcomeOddsToProjectIds(args: {
  outcomes: GoalOddsOutcome[]
  teamIds: readonly bigint[]
  /** Percents as returned by useDePrizeMarket (`calcMarginalPrice * 100`). */
  probabilities: readonly number[]
}): Record<string, number> | undefined {
  const { outcomes, teamIds, probabilities } = args
  const n = outcomes.length
  if (n === 0) return undefined
  if (teamIds.length !== n || probabilities.length !== n) return undefined

  for (let i = 0; i < n; i++) {
    const expected = outcomes[i].teamId
    if (expected === undefined) continue
    if (teamIds[i] !== BigInt(expected)) return undefined
  }

  const out: Record<string, number> = {}
  let finite = 0
  for (let i = 0; i < n; i++) {
    const p = probabilities[i]
    if (!Number.isFinite(p)) continue
    out[outcomes[i].projectId] = p / 100
    finite++
  }
  return finite > 0 ? out : undefined
}
