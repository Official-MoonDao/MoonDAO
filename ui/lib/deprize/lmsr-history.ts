// Pure LMSR odds-history reconstruction from trade events. No React / thirdweb
// imports so `yarn test:deprize` can cover it.
//
// Gnosis LMSR marginal price:
//   b   = funding / ln(n)
//   q_i = net outcome tokens sold for i (cumulative Σ outcomeTokenAmounts[i])
//   p_i = exp(q_i/b) / Σ_j exp(q_j/b)  ==  1 / Σ_j exp((q_j - q_i)/b)
// The second form never overflows.

import type { OddsSample } from './odds-chart'

export type TradeLike = {
  timestampMs: number
  /** Signed outcome-token deltas in ETH units (positive = bought from the AMM). */
  amounts: number[]
}

export type FundingLike = { timestampMs: number; deltaEth: number }

export type TradeMarker = {
  t: number
  /** Outcome the trade was mostly about (largest |amount|). */
  index: number
  /** True when the AMM sold tokens (a bet), false for a cash-out. */
  buy: boolean
}

/** Marginal prices in percent (sum ≈ 100). */
export function lmsrMarginalPrices(qEth: number[], fundingEth: number): number[] {
  const n = qEth.length
  if (n === 0) return []
  if (n === 1) return [100]
  if (!(fundingEth > 0)) return qEth.map(() => 100 / n)
  const b = fundingEth / Math.log(n)
  return qEth.map((qi) => {
    let denom = 0
    for (const qj of qEth) denom += Math.exp((qj - qi) / b)
    return 100 / denom
  })
}

/**
 * Rebuild the odds series from market open: first sample at `marketStartMs`
 * (uniform prior), then one sample after every trade. Trades and funding
 * changes are merged chronologically.
 */
export function rebuildOddsHistory(args: {
  marketStartMs: number
  initialFundingEth: number
  trades: TradeLike[]
  fundingChanges?: FundingLike[]
  numOutcomes: number
}): { history: OddsSample[]; markers: TradeMarker[] } {
  const { marketStartMs, initialFundingEth, trades, fundingChanges = [], numOutcomes } = args
  const q = Array.from({ length: numOutcomes }, () => 0)
  let funding = initialFundingEth

  type Ev = { t: number; trade?: TradeLike; funding?: FundingLike }
  const events: Ev[] = [
    ...trades.map((tr) => ({ t: tr.timestampMs, trade: tr })),
    ...fundingChanges.map((fc) => ({ t: fc.timestampMs, funding: fc })),
  ].sort((a, b) => a.t - b.t)

  const history: OddsSample[] = [
    { t: marketStartMs, p: lmsrMarginalPrices(q, funding) },
  ]
  const markers: TradeMarker[] = []

  for (const ev of events) {
    if (ev.funding) funding += ev.funding.deltaEth
    if (ev.trade) {
      const a = ev.trade.amounts
      let best = 0
      for (let i = 0; i < Math.min(a.length, numOutcomes); i++) {
        q[i] += a[i] ?? 0
        if (Math.abs(a[i] ?? 0) > Math.abs(a[best] ?? 0)) best = i
      }
      markers.push({ t: ev.t, index: best, buy: (a[best] ?? 0) > 0 })
    }
    // Never emit a sample before market open (clock skew / same-block trades).
    const t = Math.max(ev.t, marketStartMs)
    history.push({ t, p: lmsrMarginalPrices(q, funding) })
  }
  return { history, markers }
}

/** Max absolute difference (percentage points) between two probability vectors. */
export function maxProbDelta(a: number[], b: number[]): number {
  let d = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i]
    const y = b[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity
    d = Math.max(d, Math.abs(x - y))
  }
  return d
}
