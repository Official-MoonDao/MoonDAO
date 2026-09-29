import { acceptSpotQuote, costIsClose, lmsrSpotBuyQty, quoteQtyByProbing } from './quote-math'
import { rpcRead } from './read'

// Re-export the pure math so existing imports from '@/lib/deprize/quote' keep
// working. The pure functions live in quote-math.ts (dependency-free) so they
// are unit-testable without loading thirdweb/app config.
export {
  SLICE_DENOMINATOR,
  betSlice,
  betBudget,
  buildAmounts,
  acceptSpotQuote,
  costIsClose,
  lmsrSpotBuyQty,
  quoteQtyByProbing,
  qtyUnderMeasuredCost,
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

// One hung eth_call is 15s, and the old probe repeated that about ten times
// in series. Stop the toast even if a read never comes back.
const QUOTE_DEADLINE_MS = 8_000

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Quote timed out. Try again.')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

async function lmsrMarginalPriceX64(lmsr: any, index: number): Promise<bigint | null> {
  if (index < 0 || index > 255) return null
  try {
    const price = await rpcRead<bigint>({
      contract: lmsr,
      method: 'calcMarginalPrice' as string,
      params: [index],
    })
    return typeof price === 'bigint' ? price : BigInt(price)
  } catch (err) {
    console.warn('[deprize] calcMarginalPrice failed', err)
    return null
  }
}

async function lmsrFundingWei(lmsr: any): Promise<bigint | null> {
  try {
    const funding = await rpcRead<bigint>({
      contract: lmsr,
      method: 'funding' as string,
      params: [],
    })
    return typeof funding === 'bigint' ? funding : BigInt(funding)
  } catch (err) {
    console.warn('[deprize] funding() failed', err)
    return null
  }
}

// How many outcome tokens does `targetWei` of collateral (the fee-INCLUSIVE
// budget) actually buy, given LMSR price impact? The market pulls
// `calcNetCost(qty) + fee`. Spot price and funding solve that in one verified
// cost read. The probe search remains for when those reads are missing.
export async function quoteQtyForBudget(
  lmsr: any,
  index: number,
  targetWei: bigint,
  numOutcomes: number,
): Promise<bigint> {
  if (!lmsr || targetWei <= 0n) return 0n
  const deadline = Date.now() + QUOTE_DEADLINE_MS
  let bestQty = 0n
  let bestCost = 0n
  try {
    return await withDeadline(
      quoteQtyForBudgetInner(lmsr, index, targetWei, numOutcomes, deadline, (qty, cost) => {
        if (cost > 0n && cost <= targetWei && qty >= bestQty) {
          bestQty = qty
          bestCost = cost
        }
      }),
      QUOTE_DEADLINE_MS
    )
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === 'Quote timed out. Try again.' &&
      bestQty > 0n &&
      costIsClose(bestCost, targetWei)
    ) {
      return bestQty
    }
    throw err
  }
}

async function quoteQtyForBudgetInner(
  lmsr: any,
  index: number,
  targetWei: bigint,
  numOutcomes: number,
  deadline: number,
  remember: (qty: bigint, cost: bigint) => void
): Promise<bigint> {
  const timedOut = () => {
    if (Date.now() >= deadline) throw new Error('Quote timed out. Try again.')
  }
  timedOut()

  // Fee, spot price, and liquidity are independent. One round trip, then a
  // single calcNetCost to confirm the solved qty still fits.
  const [feeOnEther, priceX64, fundingWei] = await Promise.all([
    lmsrMarketFee(lmsr, 10n ** 18n),
    lmsrMarginalPriceX64(lmsr, index),
    lmsrFundingWei(lmsr),
  ])
  timedOut()

  const feeInclusiveCost = async (qty: bigint): Promise<bigint> => {
    timedOut()
    const net = await lmsrNetCost(lmsr, index, qty, numOutcomes)
    if (net <= 0n) return 0n
    const cost = net + (net * feeOnEther) / 10n ** 18n
    remember(qty, cost)
    return cost
  }

  if (priceX64 != null && fundingWei != null && priceX64 > 0n && fundingWei > 0n) {
    const netBudget = (targetWei * 10n ** 18n) / (10n ** 18n + feeOnEther)
    const estimate = lmsrSpotBuyQty({
      fundingWei,
      marginalPriceX64: priceX64,
      numOutcomes,
      netBudgetWei: netBudget,
    })
    if (estimate != null) {
      const spotQty = await acceptSpotQuote(feeInclusiveCost, targetWei, estimate, priceX64)
      if (spotQty != null && spotQty > 0n) return spotQty
    }
  }

  return await quoteQtyByProbing(feeInclusiveCost, targetWei)
}
