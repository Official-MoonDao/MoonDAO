import { searchMaxQtyWithinCost } from './quote-math'
import { rpcRead } from './read'

// Re-export the pure math so existing imports from '@/lib/deprize/quote' keep
// working. The pure functions live in quote-math.ts (dependency-free) so they
// are unit-testable without loading thirdweb/app config.
export {
  SLICE_DENOMINATOR,
  betSlice,
  betBudget,
  buildAmounts,
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
// `calcNetCost(qty) + calcMarketFee(calcNetCost(qty))`, so we binary-search the
// largest qty whose fee-inclusive cost is still <= targetWei.
export async function quoteQtyForBudget(
  lmsr: any,
  index: number,
  targetWei: bigint,
  numOutcomes: number,
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
