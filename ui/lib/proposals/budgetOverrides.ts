/**
 * Manual, hardcoded budget overrides consulted BEFORE the IPFS-based
 * extractor and other budget sources. If an override exists, it takes
 * precedence and short-circuits the rest of `extractUsdBudget()`. Used when
 * a proposal author agrees to revise their requested budget (typically
 * downward, to fit under the quarterly 3/4-cap so that more projects can be
 * funded) without re-uploading a new proposal payload.
 *
 * Keys are MDP numbers (string or number tolerated). Values are USD amounts.
 *
 * Process for adding an entry:
 *   1. Confirm the agreed amount with the proposal author in writing.
 *   2. Add an entry below with a one-line comment citing the conversation
 *      / approval (Discord link, GitHub PR, etc.) and the cycle it applies
 *      to. Once a cycle closes the override doesn't need to stay in code,
 *      but pruning it costs nothing — we just delete the entry next cycle.
 *   3. The override flows through `extractUsdBudget` (and therefore the
 *      tally + display) automatically.
 */

export const BUDGET_OVERRIDES_USD: Record<string, number> = {
  // No active overrides. See file header for the process to add one.
}

export function getBudgetOverrideUSD(
  MDP: number | string | null | undefined
): number | null {
  if (MDP === null || MDP === undefined) return null
  const key = String(MDP)
  if (!(key in BUDGET_OVERRIDES_USD)) return null
  const value = BUDGET_OVERRIDES_USD[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return value
}
