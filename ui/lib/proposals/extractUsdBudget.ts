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

function isUsdValue(rawCell: string): boolean {
  if (NON_USD_TOKENS.test(rawCell)) return false
  if (/\$/.test(rawCell)) return true
  return /\b(USDC|USDT|DAI|USD)\b/i.test(rawCell)
}

function parseAmount(cell: string): number {
  const match = cell.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
  if (!match) return 0
  return parseFloat(match[1].replace(/,/g, '')) || 0
}

type TableRowPair = { desc: string; value: string }

/**
 * Extract `| description | numeric value |` cell pairs from markdown table
 * rows, scanning line by line and splitting on pipes.
 *
 * This used to be a single global regex with nested lazy quantifiers run over
 * the whole body. On large bodies it backtracked catastrophically — a 333KB
 * proposal (MDP 259) pinned the browser main thread for ~40s PER PASS, which
 * is what froze /dashboard and /projects with "Page Unresponsive". Splitting
 * into lines and cells first keeps the work linear in body size.
 */
function extractTableRowPairs(text: string): TableRowPair[] {
  const pairs: TableRowPair[] = []
  for (const line of text.split('\n')) {
    if (line.indexOf('|') === -1) continue
    if (/---/.test(line)) continue // markdown table separator row
    const cells = line.split('|')
    // cells[0] is the text before the first pipe and cells[length-1] the text
    // after the last pipe; only interior cells are table columns.
    const lastInterior = cells.length - 2
    let i = 1
    while (i < lastInterior) {
      const desc = cells[i].trim()
      const value = cells[i + 1].trim()
      if (desc && /\d/.test(value)) {
        pairs.push({ desc, value })
        // The old regex consumed the value cell's closing pipe, so matched
        // pairs advanced two cells at a time.
        i += 2
      } else {
        i += 1
      }
    }
  }
  return pairs
}

function findGrandTotal(text: string): number {
  for (const { desc, value } of extractTableRowPairs(text)) {
    if (/\bgrand\s+total\b/i.test(desc) && isUsdValue(value)) {
      return parseAmount(value)
    }
  }
  return 0
}

function sumUsdTotals(text: string): number {
  let sum = 0
  let count = 0
  for (const { desc, value } of extractTableRowPairs(text)) {
    if (!/\b[Tt]otal\b/i.test(desc)) continue
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

function parseInlineUsdBudget(body: string): number {
  const inline = body.match(
    /(?:estimated|total|project)\s+budget\s*:?\s*\(?\s*\$\s*([\d,]+(?:\.\d+)?)/i
  )
  if (inline) return parseFloat(inline[1].replace(/,/g, '')) || 0
  return 0
}

export function parseUsdBudgetFromBody(body: string | undefined | null): number {
  if (!body || typeof body !== 'string') return 0

  const inline = parseInlineUsdBudget(body)
  if (inline > 0) return inline

  const budgetHeading = body.match(
    /^#{1,3}\s+Budget(?:\s+(?:Allocation|Breakdown|Overview|Summary))?\s*(?:\(.*?\))?\s*$/im
  )
  if (budgetHeading && budgetHeading.index !== undefined) {
    const sectionStart = budgetHeading.index + budgetHeading[0].length
    const nextHeading = body.slice(sectionStart).search(/^#{1,2}\s+(?!#)/m)
    const section =
      nextHeading !== -1
        ? body.slice(sectionStart, sectionStart + nextHeading)
        : body.slice(sectionStart)
    const result = parseBudgetFromSection(section)
    if (result > 0) return result
  }

  const grand = findGrandTotal(body)
  if (grand > 0) return grand
  const totals = sumUsdTotals(body)
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
    return stablecoinAddresses.some((a) => a.toLowerCase() === lowered)
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
