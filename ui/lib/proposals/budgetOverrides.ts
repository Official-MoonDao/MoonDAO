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
  // Q2 2026: MDP-237 ("Moon Founder's Club"). The proposal body / IPFS
  // extractor returns $4,898 (the original request line item) but the
  // approved/audited budget for the cycle was $4,650 — see
  // `audit-q2-2026-votes.mjs`'s KNOWN_BUDGETS and the original
  // published audit screenshot. Pin to the audited value so the
  // displayed budget and the budget-cap math both match.
  '237': 4650,

  // Q3 2026: MDP-250 ("Human Space Migration Ethics Framework"). The body
  // parser returns $0 because the budget is written as freeform prose
  // ("Total costs: (820 + 88 + 3200) $= $4108") rather than a table row
  // the extractor recognises.
  '250': 4108,

  // Q3 2026: MDP-251 ("MDRS Crew Seat"). Author James Burk revised the
  // budget downward from $5,500 to $4,000 after submission. The extractor
  // reads the original $5,500 correctly; this override pins the agreed
  // revised amount.
  '251': 4000,

  // Q3 2026: MDP-255 ("AORA Aerospace E-Learning Platform"). The body
  // parser over-counts to ~$219,500 by summing the Revenue Potential
  // projection table instead of the funding ask. Correct ask is $3,000.
  '255': 3000,

  // Q3 2026: MDP-258 ("Satellite Payload and Secondary Education Project").
  // The body has a malformed total row ("| Total | USD 5,176.80" with no
  // closing pipe) so the extractor drops it and instead picks up the
  // "$21.63/day" figure from a Meals justification cell, displaying $21.
  // The proposal's own table total is $5,176.80 while the author states
  // "Requested budget: USD 4,682" (fundraising the remainder elsewhere).
  // Pinned to the quarterly per-project maximum (MAX_BUDGET_USD =
  // round(NEXT_QUARTER_BUDGET_USD / 5) = $4,682) per the author's request.
  '258': 4682,

  // Q3 2026: MDP-259 ("Mission Cosmic Colombia"). The parser returns $0
  // because the totals row contains a mixed-currency cell ("$2430 USD
  // 1.30 ETH") which isUsdValue() rejects due to the ETH mention.
  '259': 2430,

  // Q3 2026: MDP-266 ("Island Zero Study Project"). The parser returns $0
  // because the totals row uses the plural "Totals", the table has three
  // columns (desc | man-days | cost), and the amount cell contains an
  // invisible U+200E mark ("US$\u200E 4,000").
  '266': 4000,
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
