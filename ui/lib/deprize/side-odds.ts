/**
 * Pure LMSR-index → side-market outcome-key odds mapping.
 *
 * The sibling of `mapOutcomeOddsToProjectIds` in goal-odds.ts, with the same
 * guards and the same percent-to-fraction conversion. It differs in two ways:
 * the key is an outcome key rather than an atlas projectId, and there is no
 * field slot — a side market's outcome set is a partition, so every slot is a
 * named outcome and nothing can land in a catch-all.
 *
 * Dependency-free so yarn test:deprize can cover it without React.
 */

export type SideOddsOutcome = {
  key: string
  /** When set, must equal teamIds[i] or the mapper returns undefined. */
  teamId?: number
}

/**
 * Map LMSR outcome probabilities onto side-market outcome keys.
 *
 * Returns fractions of 1, drops non-finite entries, and returns `undefined` on
 * any length mismatch or teamId checksum failure. Blank is recoverable; wrong
 * attribution ("Lost on descent" priced as "Upright and working") is not.
 *
 * Also returns `undefined` when no finite odds survive — a loading or closed
 * market reads all-NaN, and an empty map would render as a row of zeroes
 * rather than as the absence of a reading.
 */
export function mapOutcomeOddsToKeys(args: {
  outcomes: readonly SideOddsOutcome[]
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

  const oddsByKey: Record<string, number> = {}
  let finite = 0
  for (let i = 0; i < n; i++) {
    const p = probabilities[i]
    if (!Number.isFinite(p)) continue
    finite++
    oddsByKey[outcomes[i].key] = p / 100
  }
  return finite > 0 ? oddsByKey : undefined
}
