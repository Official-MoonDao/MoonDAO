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

type QuoteReadOpts = {
  /** Drop the quote when the amount changed. Checked before each RPC. */
  cancelled?: () => boolean
}

class QuoteCancelled extends Error {
  constructor() {
    super('Quote cancelled')
    this.name = 'QuoteCancelled'
  }
}

export function isQuoteCancelled(err: unknown): boolean {
  return err instanceof Error && err.name === 'QuoteCancelled'
}

function ensureCurrent(opts?: QuoteReadOpts) {
  if (opts?.cancelled?.()) throw new QuoteCancelled()
}

// The payout quote is the read the person is waiting on. Priority keeps it
// ahead of the page's background market reads, which otherwise fill the
// three-at-a-time RPC cap and make this line time out.
async function quoteRead<T>(
  args: Parameters<typeof rpcRead>[0],
  opts?: QuoteReadOpts
): Promise<T> {
  ensureCurrent(opts)
  return rpcRead<T>(args, { priority: true })
}

// LMSR net cost (EXCLUDING the market-maker fee) for buying `qty` outcome
// tokens on `index`. Signed: positive to buy, negative when selling.
export async function lmsrNetCost(
  lmsr: any,
  index: number,
  qty: bigint,
  numOutcomes: number,
  opts?: QuoteReadOpts,
): Promise<bigint> {
  const amounts = buildAmounts(index, qty, numOutcomes)
  return await quoteRead<bigint>(
    {
      contract: lmsr,
      method: 'calcNetCost' as string,
      params: [amounts],
    },
    opts
  )
}

// The 1% market-maker fee the LMSR charges on top of net cost.
export async function lmsrMarketFee(
  lmsr: any,
  netWei: bigint,
  opts?: QuoteReadOpts
): Promise<bigint> {
  try {
    return await quoteRead<bigint>(
      {
        contract: lmsr,
        method: 'calcMarketFee' as string,
        params: [netWei],
      },
      opts
    )
  } catch (err) {
    if (isQuoteCancelled(err)) throw err
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

async function lmsrMarginalPriceX64(
  lmsr: any,
  index: number,
  opts?: QuoteReadOpts
): Promise<bigint | null> {
  if (index < 0 || index > 255) return null
  try {
    const price = await quoteRead<bigint>(
      {
        contract: lmsr,
        method: 'calcMarginalPrice' as string,
        params: [index],
      },
      opts
    )
    return typeof price === 'bigint' ? price : BigInt(price)
  } catch (err) {
    if (isQuoteCancelled(err)) throw err
    console.warn('[deprize] calcMarginalPrice failed', err)
    return null
  }
}

async function lmsrFundingWei(lmsr: any, opts?: QuoteReadOpts): Promise<bigint | null> {
  try {
    const funding = await quoteRead<bigint>(
      {
        contract: lmsr,
        method: 'funding' as string,
        params: [],
      },
      opts
    )
    return typeof funding === 'bigint' ? funding : BigInt(funding)
  } catch (err) {
    if (isQuoteCancelled(err)) throw err
    console.warn('[deprize] funding() failed', err)
    return null
  }
}

// Fee, spot price, and liquidity do not depend on the bet amount. Re-reading
// them on every keystroke stacked RPC calls until the payout line timed out.
const SPOT_TTL_MS = 30_000
type SpotParams = {
  at: number
  feeOnEther: bigint
  priceX64: bigint | null
  fundingWei: bigint | null
}
const spotCache = new Map<string, SpotParams | Promise<SpotParams>>()

function spotKey(lmsr: any, index: number): string {
  return `${String(lmsr?.address ?? '').toLowerCase()}:${index}`
}

async function loadSpotParams(
  lmsr: any,
  index: number,
  opts?: QuoteReadOpts
): Promise<SpotParams> {
  ensureCurrent(opts)
  const key = spotKey(lmsr, index)
  const hit = spotCache.get(key)
  if (hit && !(hit instanceof Promise) && Date.now() - hit.at < SPOT_TTL_MS) return hit
  if (hit instanceof Promise) return hit
  const pending = (async () => {
    const [feeOnEther, priceX64, fundingWei] = await Promise.all([
      lmsrMarketFee(lmsr, 10n ** 18n, opts),
      lmsrMarginalPriceX64(lmsr, index, opts),
      lmsrFundingWei(lmsr, opts),
    ])
    const value: SpotParams = { at: Date.now(), feeOnEther, priceX64, fundingWei }
    spotCache.set(key, value)
    return value
  })()
  spotCache.set(key, pending)
  try {
    return await pending
  } catch (err) {
    if (spotCache.get(key) === pending) spotCache.delete(key)
    throw err
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
  opts?: QuoteReadOpts,
): Promise<bigint> {
  if (!lmsr || targetWei <= 0n) return 0n
  ensureCurrent(opts)
  const deadline = Date.now() + QUOTE_DEADLINE_MS
  let bestQty = 0n
  let bestCost = 0n
  try {
    return await withDeadline(
      quoteQtyForBudgetInner(
        lmsr,
        index,
        targetWei,
        numOutcomes,
        deadline,
        opts,
        (qty, cost) => {
          if (cost > 0n && cost <= targetWei && qty >= bestQty) {
            bestQty = qty
            bestCost = cost
          }
        }
      ),
      QUOTE_DEADLINE_MS
    )
  } catch (err) {
    if (isQuoteCancelled(err)) throw err
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
  opts: QuoteReadOpts | undefined,
  remember: (qty: bigint, cost: bigint) => void
): Promise<bigint> {
  const timedOut = () => {
    if (opts?.cancelled?.()) throw new QuoteCancelled()
    if (Date.now() >= deadline) throw new Error('Quote timed out. Try again.')
  }
  timedOut()

  // Fee, spot price, and liquidity are independent of the amount. Cached so
  // the next chip is one cost read, not another three-call round trip.
  const { feeOnEther, priceX64, fundingWei } = await loadSpotParams(lmsr, index, opts)
  timedOut()

  const feeInclusiveCost = async (qty: bigint): Promise<bigint> => {
    timedOut()
    const net = await lmsrNetCost(lmsr, index, qty, numOutcomes, opts)
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
