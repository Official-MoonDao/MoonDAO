/**
 * Manual, hardcoded budget overrides applied AFTER the IPFS-based extractor
 * runs. Used when a proposal author agrees to revise their requested budget
 * (typically downward, to fit under the quarterly 3/4-cap so that more
 * projects can be funded) without re-uploading a new proposal payload.
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
  // MDP-245 — "MoonDAO – Deployable Video Payload for Sounding Rocket".
  // Original IPFS body parsed to $3,233.84 (Total Fixed Costs $2,233.84
  // + Total Bounties $1,000). Author agreed to trim to $2,700 so the
  // project fits under Q2 2026's remaining 3/4-cap headroom of $2,701.75
  // and can be funded as the 5th Member-Vote winner. Applies to Q2 2026.
  '245': 2700,
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
