/**
 * Resolve the USD budget of a proposal payload.
 *
 * Mirrors the pipeline `useProposalJSON` (the proposal hook) uses on the
 * client so server-side consumers (the member-vote tally + display) report
 * the same number the rest of the UI shows. Resolution order:
 *
 *   0. `BUDGET_OVERRIDES_USD[MDP]` — short-circuits everything else when
 *      the caller supplies an `MDP`. Used for hand-negotiated post-submit
 *      adjustments (e.g. an author trimming their request to fit under
 *      the cap) so we don't have to re-pin the IPFS payload.
 *   1. `proposal.totalBudgetUSDC` — precomputed aggregate written by the
 *      proposal editor.
 *   2. `proposal.budget[]` — sum entries whose `token` is USD-like. The
 *      editor's `SafeTokenForm` writes the budget item's `token` field as
 *      the *contract address* of the selected token (USDC/DAI on the
 *      target chain), not the symbol, so we accept both the legacy symbol
 *      form ('USD'/'USDC'/'USDT'/'DAI', case-insensitive) and any address
 *      provided in `stablecoinAddresses`.
 *   3. Body parsing — for older proposals that wrote the budget into the
 *      markdown body (a "Grand Total" / USD totals row, a `Total Budget:
 *      $X` callout, or freeform "Item — $1,234" lines).
 *
 * Returns `0` when nothing usable is found. Always non-negative.
 */
import { getBudgetOverrideUSD } from '@/lib/proposals/budgetOverrides'

const STABLECOIN_SYMBOLS = new Set(['usd', 'usdc', 'usdt', 'dai'])

const NON_USD_TOKENS = /\b(ETH|MOONEY|BTC|MATIC|ARB|OP|SOL)\b/i

// Freeform "Item — $1,234" budget lines are short; skip anything longer so a
// pathological single-line paragraph can't feed the regex below.
const MAX_FREEFORM_LINE_LENGTH = 500

/**
 * Strip invisible Unicode directional / zero-width marks that can embed in
 * copy-pasted text (e.g. U+200E left-to-right mark in "US$‎ 4,000").
 * Must be called before any regex-based parsing.
 */
function sanitizeText(text: string): string {
  return text.replace(/[\u200B-\u200F\uFEFF\u2060]/g, '')
}

function isUsdValue(rawCell: string): boolean {
  // A leading $ or an explicit stablecoin keyword confirms USD even when the
  // cell also mentions non-USD tokens (e.g. "$2,430 USD  1.30 ETH").
  // The old code checked NON_USD_TOKENS first, which caused the whole cell
  // to be rejected whenever ETH/MOONEY appeared alongside a USD amount.
  if (/\$/.test(rawCell)) return true
  if (/\b(USDC|USDT|DAI|USD)\b/i.test(rawCell)) return true
  return false
}

function parseAmount(cell: string): number {
  const match = cell.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
  if (!match) return 0
  return parseFloat(match[1].replace(/,/g, '')) || 0
}

type TableRowPair = { desc: string; value: string }

/**
 * Extract `{ desc, value }` pairs from markdown table rows, scanning line
 * by line and splitting on pipes.
 *
 * For each row:
 *   - `desc`  = the first non-empty interior cell.
 *   - `value` = the first cell (after `desc`) that contains an explicit
 *               USD marker ($ or stablecoin keyword).  If no USD cell is
 *               found, falls back to the last numeric cell.
 *
 * This handles both:
 *   desc | $amount | justification text   → picks $amount  (MDP-251 style)
 *   desc | quantity | $cost               → picks $cost    (MDP-266 style)
 *
 * Previously this was a single global regex with nested lazy quantifiers.
 * On large bodies it backtracked catastrophically — a 333 KB proposal
 * pinned the browser main thread for ~40 s per pass. Splitting into lines
 * and cells first keeps the work O(n) in body size.
 */
function extractTableRowPairs(text: string): TableRowPair[] {
  const pairs: TableRowPair[] = []
  for (const line of text.split('\n')) {
    if (line.indexOf('|') === -1) continue
    if (/---/.test(line)) continue
    const interior = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
      .filter(Boolean)
    if (interior.length < 2) continue
    const desc = interior[0]

    // Scan forward from the second cell; prefer the first cell that carries
    // an explicit USD marker, but remember the last numeric cell as a fallback.
    let value = ''
    for (let i = 1; i < interior.length; i++) {
      const cell = interior[i]
      if (!/\d/.test(cell)) continue
      value = cell
      if (isUsdValue(cell)) break // stop on the first explicit USD cell
    }
    if (value) pairs.push({ desc, value })
  }
  return pairs
}

function findGrandTotal(text: string): number {
  for (const { desc, value } of extractTableRowPairs(text)) {
    if (/\bgrand\s+totals?\b/i.test(desc) && isUsdValue(value)) {
      return parseAmount(value)
    }
  }
  return 0
}

function sumUsdTotals(text: string): number {
  let sum = 0
  let count = 0
  for (const { desc, value } of extractTableRowPairs(text)) {
    // Match both "Total" and "Totals" (plural used by some budget templates).
    if (!/\btotals?\b/i.test(desc)) continue
    if (!isUsdValue(value)) continue
    sum += parseAmount(value)
    count++
  }
  return count > 0 ? sum : 0
}

const FREEFORM_LINE_PATTERN =
  /^\s*(?:[-*•]\s*)?(?:[A-Za-z][A-Za-z &/()'-]{2,}?)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)(?:\s*(?:-|to|–|—)\s*\$?\s*([\d,]+(?:\.\d+)?))?\s*(?:USD|USDC|USDT|DAI)?\s*$/i

function sumFreeformBudgetLines(text: string): number {
  let total = 0
  let matched = false
  for (const line of text.split('\n')) {
    if (line.length > MAX_FREEFORM_LINE_LENGTH) continue
    const m = line.match(FREEFORM_LINE_PATTERN)
    if (!m) continue
    if (NON_USD_TOKENS.test(m[0])) continue
    const low = parseFloat(m[1].replace(/,/g, '')) || 0
    const high = m[2] ? parseFloat(m[2].replace(/,/g, '')) || 0 : 0
    const value = high > low ? high : low
    if (value <= 0) continue
    total += value
    matched = true
  }
  return matched ? total : 0
}

function parseBudgetFromSection(text: string): number {
  const grand = findGrandTotal(text)
  if (grand > 0) return grand

  const totals = sumUsdTotals(text)
  if (totals > 0) return totals

  let sum = 0
  for (const { value } of extractTableRowPairs(text)) {
    if (!isUsdValue(value)) continue
    sum += parseAmount(value)
  }
  if (sum > 0) return sum

  return sumFreeformBudgetLines(text)
}

/**
 * Scan each line for a budget trigger phrase and return the largest dollar
 * amount found AFTER the trigger phrase on that same line. Taking the maximum
 * handles patterns like:
 *
 *   "Total Budget: $5,000 (includes $500 contingency)"  → 5000
 *   "Total costs: (820 + 88 + 3200) $= $4108"           → 4108
 *   "Total Requested from MoonDAO: $2430 USD"            → 2430
 *
 * Only amounts that occur AFTER the trigger phrase count. Without this,
 * a prose justification that happens to contain a trigger substring hijacks
 * an unrelated amount earlier on the line — e.g. a line-item row
 * "Contingency | $400 | Unexpected project costs" matched "project costs"
 * and returned $400 as the whole budget (MDP-264).
 *
 * If no `$X` pattern exists but a bare "N USD/USDC" pattern is present after
 * the trigger, that value is returned instead.
 */
function parseInlineUsdBudget(body: string): number {
  const TRIGGER =
    /(?:total|estimated|project)\s+(?:budget|costs?|funding|requested?(?:\s+from\s+\w+)?|ask)/i
  for (const line of body.split('\n')) {
    const triggerMatch = line.match(TRIGGER)
    if (!triggerMatch || triggerMatch.index === undefined) continue
    const afterTrigger = line.slice(triggerMatch.index + triggerMatch[0].length)
    const dollars = Array.from(afterTrigger.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g))
      .map((m) => parseFloat(m[1].replace(/,/g, '')) || 0)
      .filter((v) => v > 0)
    if (dollars.length > 0) return Math.max(...dollars)
    // No $ sign — try bare "N USD/USDC/DAI" after the trigger phrase.
    const bare = afterTrigger.match(
      /\b([\d,]+(?:\.\d+)?)\s*(?:USD|USDC|USDT|DAI)\b/i
    )
    if (bare) {
      const v = parseFloat(bare[1].replace(/,/g, '')) || 0
      if (v > 0) return v
    }
  }
  return 0
}

export function parseUsdBudgetFromBody(body: string | undefined | null): number {
  if (!body || typeof body !== 'string') return 0

  // Strip invisible Unicode control/directional marks before any parsing so
  // characters like U+200E ("US$‎ 4,000") don't silently break $ detection.
  const sanitized = sanitizeText(body)

  const inline = parseInlineUsdBudget(sanitized)
  if (inline > 0) return inline

  // Budget heading — handle optional Table label and trailing # markers that
  // some editors emit (e.g. "# Budget (Table C)#").
  const budgetHeading = sanitized.match(
    /^#{1,3}\s+Budget(?:\s+[^\n#]*?)?\s*#*\s*$/im
  )
  if (budgetHeading && budgetHeading.index !== undefined) {
    const sectionStart = budgetHeading.index + budgetHeading[0].length
    const nextHeading = sanitized.slice(sectionStart).search(/^#{1,2}\s+(?!#)/m)
    const section =
      nextHeading !== -1
        ? sanitized.slice(sectionStart, sectionStart + nextHeading)
        : sanitized.slice(sectionStart)
    const result = parseBudgetFromSection(section)
    if (result > 0) return result
    // The budget heading was found but its section contains no parseable
    // total. Stop here rather than falling through to the whole-body scan —
    // that risks summing Revenue / Projection tables elsewhere in the body
    // and producing a wildly inflated number (e.g. MDP-255 read $219,500).
    return 0
  }

  // No budget section heading found — whole-body fallback is safe because
  // there is no Revenue table to accidentally absorb.
  const grand = findGrandTotal(sanitized)
  if (grand > 0) return grand
  const totals = sumUsdTotals(sanitized)
  if (totals > 0) return totals

  return 0
}

function isUsdLikeTokenField(
  token: unknown,
  stablecoinAddresses?: ReadonlySet<string> | string[] | null
): boolean {
  if (typeof token !== 'string') return false
  const trimmed = token.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('0x')) {
    if (!stablecoinAddresses) return false
    const lowered = trimmed.toLowerCase()
    if (stablecoinAddresses instanceof Set) return stablecoinAddresses.has(lowered)
    if (Array.isArray(stablecoinAddresses)) {
      return stablecoinAddresses.some((a: string) => a.toLowerCase() === lowered)
    }
    return false
  }
  return STABLECOIN_SYMBOLS.has(trimmed.toLowerCase())
}

function sumBudgetArray(
  budget: unknown,
  stablecoinAddresses?: ReadonlySet<string> | string[] | null
): number {
  if (!Array.isArray(budget)) return 0
  let total = 0
  for (const item of budget) {
    if (!item || typeof item !== 'object') continue
    if (!isUsdLikeTokenField((item as any).token, stablecoinAddresses)) continue
    const amount = Number((item as any).amount)
    if (Number.isFinite(amount) && amount > 0) total += amount
  }
  return total
}

export function extractUsdBudget(
  proposal: any,
  options?: {
    /**
     * Optional set/list of stablecoin contract addresses (USDC/USDT/DAI) on
     * the chain the proposal was authored against. Used to recognize budget
     * items whose `token` field stores the token address rather than the
     * symbol — the form `SafeTokenForm` actually writes today.
     */
    stablecoinAddresses?: ReadonlySet<string> | string[] | null
    /**
     * Optional MDP number for the proposal. When supplied, manual budget
     * overrides (`BUDGET_OVERRIDES_USD`) for that MDP take precedence over
     * everything below. Pass it whenever you have it so display and tally
     * stay in lock-step with author-negotiated revisions.
     */
    MDP?: number | string | null
  }
): number {
  const override = getBudgetOverrideUSD(options?.MDP)
  if (override !== null) return override

  if (!proposal || typeof proposal !== 'object') return 0

  if (proposal.totalBudgetUSDC != null) {
    const total = Number(proposal.totalBudgetUSDC)
    if (Number.isFinite(total) && total > 0) return total
  }

  const fromArray = sumBudgetArray(
    proposal.budget,
    options?.stablecoinAddresses
  )
  if (fromArray > 0) return fromArray

  return parseUsdBudgetFromBody(proposal.body)
}
