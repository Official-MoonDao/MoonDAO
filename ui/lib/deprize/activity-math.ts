// Pure aggregation over DePrize on-chain activity (Bet events from DePrizeMint,
// sell trades from the LMSR). No React / thirdweb imports so `yarn test:deprize`
// can cover it.
//
// Money model (see docs/DEPRIZE_DETAIL_PAGE_PLAN.md §0.1–0.2):
//   bet.costEth   — what went into the betting market (LMSR net cost + 1% fee)
//   bet.sliceEth  — the 5% prize slice paid to the Juicebox prize pool
//   total spent   — costEth + sliceEth (both are real money the bettor paid)
//   sell.proceeds — ETH returned to the seller net of the LMSR fee

export type BetRow = {
  bettor: string // lowercase
  outcomeIndex: number
  qty: number // outcome tokens (1 token pays 1 ETH if the outcome wins)
  costEth: number
  sliceEth: number
  blockNumber: bigint
  logIndex: number
  txHash: string
  timestampMs: number
}

export type SellRow = {
  seller: string // lowercase
  outcomeIndex: number
  qty: number // positive number of tokens sold
  proceedsEth: number
  blockNumber: bigint
  logIndex: number
  txHash: string
  timestampMs: number
}

export type ActivityRow =
  | ({ kind: 'bet' } & BetRow)
  | ({ kind: 'sell' } & SellRow)

export type OutcomePosition = {
  outcomeIndex: number
  qtyBought: number
  qtySold: number
  qtyHeld: number
  /** Total paid for every token ever bought on this outcome (cost + slice). */
  spentEth: number
  /** Average all-in cost per token bought. */
  avgCostEth: number
  /** Cost basis attributed to tokens still held (average-cost method). */
  heldCostEth: number
  proceedsEth: number
}

export type UserSummary = {
  totalSpentEth: number
  realizedEth: number
  currentValueEth: number
  heldCostEth: number
  unrealizedPnlEth: number
  netPnlEth: number
}

export function totalBet(bets: BetRow[]): number {
  return bets.reduce((s, b) => s + b.costEth, 0)
}

export function uniqueBackers(bets: BetRow[]): number {
  return new Set(bets.map((b) => b.bettor.toLowerCase())).size
}

/** Total ETH bettors have put into the market side (costEth only; the slice is prize pool). */
export function totalStaked(bets: BetRow[]): number {
  return totalBet(bets)
}

export function userPosition(
  bets: BetRow[],
  sells: SellRow[],
  user: string,
  outcomeIndex: number,
): OutcomePosition {
  const u = user.toLowerCase()
  let qtyBought = 0
  let spentEth = 0
  for (const b of bets) {
    if (b.bettor !== u || b.outcomeIndex !== outcomeIndex) continue
    qtyBought += b.qty
    spentEth += b.costEth + b.sliceEth
  }
  let qtySold = 0
  let proceedsEth = 0
  for (const s of sells) {
    if (s.seller !== u || s.outcomeIndex !== outcomeIndex) continue
    qtySold += s.qty
    proceedsEth += s.proceedsEth
  }
  const qtyHeld = Math.max(0, qtyBought - qtySold)
  const avgCostEth = qtyBought > 0 ? spentEth / qtyBought : 0
  return {
    outcomeIndex,
    qtyBought,
    qtySold,
    qtyHeld,
    spentEth,
    avgCostEth,
    heldCostEth: avgCostEth * qtyHeld,
    proceedsEth,
  }
}

/** Outcome indices where the user has ever bought or sold. */
export function userActiveOutcomes(bets: BetRow[], sells: SellRow[], user: string): number[] {
  const u = user.toLowerCase()
  const set = new Set<number>()
  for (const b of bets) if (b.bettor === u) set.add(b.outcomeIndex)
  for (const s of sells) if (s.seller === u) set.add(s.outcomeIndex)
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Wallet-level summary. `currentValueByIndex` is what the user's held tokens
 * are worth right now (live sell quote while trading, redeem value once
 * resolved). Outcomes missing from the map contribute 0 current value.
 */
export function userSummary(
  bets: BetRow[],
  sells: SellRow[],
  user: string,
  currentValueByIndex: Map<number, number>,
): UserSummary {
  let totalSpentEth = 0
  let realizedEth = 0
  let heldCostEth = 0
  let currentValueEth = 0
  for (const idx of userActiveOutcomes(bets, sells, user)) {
    const p = userPosition(bets, sells, user, idx)
    totalSpentEth += p.spentEth
    realizedEth += p.proceedsEth
    heldCostEth += p.heldCostEth
    const v = currentValueByIndex.get(idx)
    if (v !== undefined && Number.isFinite(v)) currentValueEth += v
  }
  const unrealizedPnlEth = currentValueEth - heldCostEth
  const netPnlEth = currentValueEth + realizedEth - totalSpentEth
  return { totalSpentEth, realizedEth, currentValueEth, heldCostEth, unrealizedPnlEth, netPnlEth }
}

/** Reverse-chronological feed of one wallet's bets and sells. */
export function userActivity(bets: BetRow[], sells: SellRow[], user: string): ActivityRow[] {
  const u = user.toLowerCase()
  const rows: ActivityRow[] = []
  for (const b of bets) if (b.bettor === u) rows.push({ kind: 'bet', ...b })
  for (const s of sells) if (s.seller === u) rows.push({ kind: 'sell', ...s })
  return rows.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1
    return b.logIndex - a.logIndex
  })
}
