import { useEffect, useState } from 'react'

// Tokens we'll ignore when looking for USD-denominated amounts. If a value in a
// table cell is suffixed with one of these (e.g. "1.71 ETH"), we shouldn't
// treat the bare number as USD.
const NON_USD_TOKENS = /\b(ETH|MOONEY|BTC|MATIC|ARB|OP|SOL)\b/i

function isUsdValue(rawCell: string): boolean {
  if (NON_USD_TOKENS.test(rawCell)) return false
  if (/\$/.test(rawCell)) return true
  return /\b(USDC|USDT|DAI|USD)\b/i.test(rawCell)
}

// Match `| <description> | <value> |` rows, capturing the description and the
// raw value cell so callers can decide how to interpret each row.
const TABLE_ROW_PATTERN =
  /\|\s*([^|]+?)\s*\|\s*([^|]*?\$?[\d,]+(?:\.\d+)?[^|]*?)\s*\|/g

function parseAmount(cell: string): number {
  const match = cell.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
  if (!match) return 0
  return parseFloat(match[1].replace(/,/g, '')) || 0
}

function findGrandTotal(text: string): number {
  TABLE_ROW_PATTERN.lastIndex = 0
  let match
  while ((match = TABLE_ROW_PATTERN.exec(text)) !== null) {
    if (/---/.test(match[0])) continue
    const desc = match[1]
    const value = match[2]
    if (/\bgrand\s+total\b/i.test(desc) && isUsdValue(value)) {
      return parseAmount(value)
    }
  }
  return 0
}

function sumUsdTotals(text: string): number {
  TABLE_ROW_PATTERN.lastIndex = 0
  let sum = 0
  let count = 0
  let match
  while ((match = TABLE_ROW_PATTERN.exec(text)) !== null) {
    if (/---/.test(match[0])) continue
    const desc = match[1]
    const value = match[2]
    if (!/\b[Tt]otal\b/i.test(desc)) continue
    if (!isUsdValue(value)) continue
    sum += parseAmount(value)
    count++
  }
  return count > 0 ? sum : 0
}

// Parse budget sections written as freeform prose rather than a markdown
// table. Handles lines like:
//   "Product and Testing 1200"
//   "Marketing and Content 2000 to 2500"
//   "Analog Mission Support: $800-$1,000"
// Ranges use the upper bound so the displayed budget reflects the maximum
// funding the proposal is requesting.
function sumFreeformBudgetLines(text: string): number {
  const lineRe =
    /^\s*(?:[-*•]\s*)?(?:[A-Za-z][A-Za-z &/()'-]{2,}?)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)(?:\s*(?:-|to|–|—)\s*\$?\s*([\d,]+(?:\.\d+)?))?\s*(?:USD|USDC|USDT|DAI)?\s*$/gim
  let total = 0
  let matched = false
  let m
  while ((m = lineRe.exec(text)) !== null) {
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
  // Prefer an explicit "GRAND TOTAL" row in USD if present.
  const grand = findGrandTotal(text)
  if (grand > 0) return grand

  // Otherwise sum every "Total" row that's clearly USD-denominated. This
  // handles proposals that split a budget into "Total Fixed Costs (USD)" and
  // "Total Bounties" while ignoring an "ETH" grand total at the bottom.
  const totals = sumUsdTotals(text)
  if (totals > 0) return totals

  // Fallback: sum each row's value, skipping rows whose value is not USD.
  TABLE_ROW_PATTERN.lastIndex = 0
  let sum = 0
  let match
  while ((match = TABLE_ROW_PATTERN.exec(text)) !== null) {
    if (/---/.test(match[0])) continue
    const value = match[2]
    if (!isUsdValue(value)) continue
    sum += parseAmount(value)
  }
  if (sum > 0) return sum

  // Last resort: proposals sometimes list budgets as freeform prose rather
  // than as a markdown table.
  return sumFreeformBudgetLines(text)
}

function parseInlineUsdBudget(body: string): number {
  const inline = body.match(
    /(?:estimated|total|project)\s+budget\s*:?\s*\(?\s*\$\s*([\d,]+(?:\.\d+)?)/i
  )
  if (inline) return parseFloat(inline[1].replace(/,/g, '')) || 0
  return 0
}

function parseUsdBudgetFromBody(body: string): number {
  // 1. Honor an explicit "Estimated Budget: ($X)" / "Total Budget: $X" callout.
  const inline = parseInlineUsdBudget(body)
  if (inline > 0) return inline

  // 2. Parse the Budget section if we can find it.
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

  // 3. Last-ditch effort: any GRAND TOTAL or USD totals anywhere in the body.
  const grand = findGrandTotal(body)
  if (grand > 0) return grand
  const totals = sumUsdTotals(body)
  if (totals > 0) return totals

  return 0
}

export default function useProposalJSON(project: any) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    async function fetchData() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()

      let usdBudget = 0

      if (proposal.totalBudgetUSDC != null) {
        usdBudget = Number(proposal.totalBudgetUSDC) || 0
      } else if (proposal.budget && Array.isArray(proposal.budget)) {
        proposal.budget.forEach((item: any) => {
          if (item.token === 'USD' || item.token === 'USDC' || item.token === 'USDT' || item.token === 'DAI') {
            usdBudget += Number(item.amount) || 0
          }
        })
      }

      if (usdBudget === 0 && proposal.body) {
        usdBudget = parseUsdBudgetFromBody(proposal.body)
      }

      proposal.usdBudget = usdBudget
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
