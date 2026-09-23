import { quoteQtyByProbing } from './quote-math'
import { rpcRead } from './read'

// Re-export the pure math so existing imports from '@/lib/deprize/quote' keep
// working. The pure functions live in quote-math.ts (dependency-free) so they
// are unit-testable without loading thirdweb/app config.
export {
  SLICE_DENOMINATOR,
  betSlice,
  betBudget,
  buildAmounts,
  quoteQtyByProbing,
  searchMaxQtyWithinCost,
} from './quote-math'

import { buildAmounts } from './quote-math'

// LMSR net cost (EXCLUDING the market-maker fee) for buying `qty` outcome
// tokens on `index`. Signed: positive to buy, negative when selling.
export async function lmsrNetCost(
  lmsr: any,
  index: number,
  qty: bigint,
  numOutcomes: number,
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
  } catch (err) {
    // Never fall back to 0: a zero fee underestimates cost and can oversize
    // qty, causing on-chain CostTooHigh reverts after the user confirms.
    console.error('[deprize] calcMarketFee failed', err)
    throw err
  }
}

// How many outcome tokens does `targetWei` of collateral (the fee-INCLUSIVE
// budget) actually buy, given LMSR price impact? The market pulls
// `calcNetCost(qty) + fee`. A short bracketed probe stays under the budget;
// the exact wei search was too many sequential RPC calls and sat on "Quoting…".
export async function quoteQtyForBudget(
  lmsr: any,
  index: number,
  targetWei: bigint,
  numOutcomes: number,
): Promise<bigint> {
  if (!lmsr || targetWei <= 0n) return 0n

  // The fee is linear in net cost. Read it once instead of on every probe.
  // A full binary search was dozens of sequential RPC calls, which left the
  // bet button sitting on "Quoting…".
  const feeOnEther = await lmsrMarketFee(lmsr, 10n ** 18n)
  const feeInclusiveCost = async (qty: bigint): Promise<bigint> => {
    const net = await lmsrNetCost(lmsr, index, qty, numOutcomes)
    if (net <= 0n) return 0n
    return net + (net * feeOnEther) / 10n ** 18n
  }

  return await quoteQtyByProbing(feeInclusiveCost, targetWei)
}
