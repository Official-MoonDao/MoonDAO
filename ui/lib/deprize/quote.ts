import { SLICE_DENOMINATOR } from './constants'
import { rpcRead } from './read'

// --- Pure bet-value split (mirrors DePrizeMint.bet) ---
// Every bet routes 5% (1/20) of msg.value to the Juicebox prize pool; the
// remaining 95% is the collateral budget the market may pull. The router caps
// the trade cost at `budget` and refunds any unspent ETH.
export function betSlice(valueWei: bigint): bigint {
  if (valueWei <= 0n) return 0n
  return valueWei / SLICE_DENOMINATOR
}

export function betBudget(valueWei: bigint): bigint {
  if (valueWei <= 0n) return 0n
  return valueWei - betSlice(valueWei)
}

// Build the LMSR trade `amounts` vector for buying `qty` of a single outcome.
export function buildAmounts(
  index: number,
  qty: bigint,
  numOutcomes: number
): bigint[] {
  return Array.from({ length: numOutcomes }, (_, j) => (j === index ? qty : 0n))
}

// LMSR net cost (EXCLUDING the market-maker fee) for buying `qty` outcome
// tokens on `index`. Signed: positive to buy, negative when selling.
export async function lmsrNetCost(
  lmsr: any,
  index: number,
  qty: bigint,
  numOutcomes: number
): Promise<bigint> {
  const amounts = buildAmounts(index, qty, numOutcomes)
  return await rpcRead<bigint>({
    contract: lmsr,
    method: 'calcNetCost' as string,
    params: [amounts],
  })
}

// The 1% market-maker fee the LMSR charges on top of net cost.
export async function lmsrMarketFee(lmsr: any, netWei: bigint): Promise<bigint> {
  try {
    return await rpcRead<bigint>({
      contract: lmsr,
      method: 'calcMarketFee' as string,
      params: [netWei],
    })
  } catch {
    return 0n
  }
}

// Pure binary search: the largest `qty` whose cost (from a monotonic-increasing
// `costFn`) is still <= `targetWei`. Cost is monotonic in qty and, for an LMSR,
// always <= qty (marginal price <= 1), so qty for a given cost is >= cost. We
// grow an upper bound from targetWei (never from a 1/price estimate, which is
// wildly off in thin markets), then binary search. Kept dependency-free so it is
// directly unit-testable with a synthetic cost function.
export async function searchMaxQtyWithinCost(
  costFn: (qty: bigint) => Promise<bigint>,
  targetWei: bigint
): Promise<bigint> {
  if (targetWei <= 0n) return 0n
  let lo = 0n
  let hi = targetWei
  for (let k = 0; k < 48; k++) {
    const c = await costFn(hi)
    if (c >= targetWei) break
    lo = hi
    hi *= 2n
  }
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2n
    if (mid <= lo) break
    const c = await costFn(mid)
    if (c <= targetWei) lo = mid
    else hi = mid
  }
  return lo
}

// How many outcome tokens does `targetWei` of collateral (the fee-INCLUSIVE
// budget) actually buy, given LMSR price impact? The market pulls
// `calcNetCost(qty) + calcMarketFee(calcNetCost(qty))`, so we binary-search the
// largest qty whose fee-inclusive cost is still <= targetWei.
export async function quoteQtyForBudget(
  lmsr: any,
  index: number,
  targetWei: bigint,
  numOutcomes: number
): Promise<bigint> {
  if (!lmsr || targetWei <= 0n) return 0n

  const feeInclusiveCost = async (qty: bigint): Promise<bigint> => {
    const net = await lmsrNetCost(lmsr, index, qty, numOutcomes)
    if (net <= 0n) return 0n
    const fee = await lmsrMarketFee(lmsr, net)
    return net + fee
  }

  return await searchMaxQtyWithinCost(feeInclusiveCost, targetWei)
}
