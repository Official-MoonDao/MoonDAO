// Pure DePrize bet/quote math. Intentionally dependency-free (no thirdweb, no
// app config) so it is directly unit-testable under the mocha/ts-node runner
// that can't load the app's ESM dependencies.

// Prize slice: every bet routes 5% (1/20) of msg.value to the Juicebox prize
// pool; the remaining 95% is the collateral budget the market may pull.
export const SLICE_DENOMINATOR = 20n

export function betSlice(valueWei: bigint): bigint {
  if (valueWei <= 0n) return 0n
  return valueWei / SLICE_DENOMINATOR
}

export function betBudget(valueWei: bigint): bigint {
  if (valueWei <= 0n) return 0n
  return valueWei - betSlice(valueWei)
}

// Build the LMSR trade `amounts` vector for buying/selling `qty` of one outcome.
export function buildAmounts(
  index: number,
  qty: bigint,
  numOutcomes: number
): bigint[] {
  return Array.from({ length: numOutcomes }, (_, j) => (j === index ? qty : 0n))
}

// Largest `qty` whose cost (from a monotonic-increasing `costFn`) is still
// <= `targetWei`. Cost is monotonic in qty and, for an LMSR, always <= qty
// (marginal price <= 1), so qty for a given cost is >= cost. We grow an upper
// bound from targetWei (never from a 1/price estimate, which is wildly off in
// thin markets), then binary search.
export async function searchMaxQtyWithinCost(
  costFn: (qty: bigint) => Promise<bigint>,
  targetWei: bigint
): Promise<bigint> {
  if (targetWei <= 0n) return 0n
  let lo = 0n
  let hi = targetWei
  // Grow hi until its cost strictly exceeds the budget, so hi is an exclusive
  // upper bound and a qty whose cost is exactly the budget is still accepted.
  for (let k = 0; k < 48; k++) {
    const c = await costFn(hi)
    if (c > targetWei) break
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

// Stop once the measured cost is within 2% of the budget. The bet already
// leaves another 1% of headroom under the on-chain max, so a closer wei is
// not worth another RPC round trip.
export function costIsClose(cost: bigint, targetWei: bigint): boolean {
  return cost > 0n && cost * 50n >= targetWei * 49n
}

async function bisectAffordableQty(
  costFn: (qty: bigint) => Promise<bigint>,
  lo: bigint,
  hi: bigint,
  targetWei: bigint,
  steps: number
): Promise<bigint> {
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2n
    if (mid <= lo) break
    const midCost = await costFn(mid)
    if (midCost <= targetWei) {
      lo = mid
      if (costIsClose(midCost, targetWei)) return lo
    } else hi = mid
  }
  return lo
}

// Gnosis LMSR marginal price is a 2^64 fixed-point fraction.
const PRICE_X64 = 2n ** 64n

/**
 * Outcome-token qty whose LMSR net cost is `netBudgetWei`.
 * b = funding / ln(n), and buying δ of an outcome priced p costs
 * b * ln(1 + p * (e^{δ/b} - 1)). Returns null when the inputs cannot
 * produce a finite qty (the caller falls back to cost probes).
 */
export function lmsrSpotBuyQty(args: {
  fundingWei: bigint
  marginalPriceX64: bigint
  numOutcomes: number
  netBudgetWei: bigint
}): bigint | null {
  const { fundingWei, marginalPriceX64, numOutcomes, netBudgetWei } = args
  if (numOutcomes < 2) return null
  if (fundingWei <= 0n || netBudgetWei <= 0n || marginalPriceX64 <= 0n) return null
  // A certain outcome costs one collateral wei per token.
  if (marginalPriceX64 >= PRICE_X64) return netBudgetWei
  const p = Number(marginalPriceX64) / Number(PRICE_X64)
  const b = Number(fundingWei) / Math.log(numOutcomes)
  const budget = Number(netBudgetWei)
  if (!(p > 0) || !(b > 0) || !(budget > 0)) return null
  // exp overflows past ~709; a bet that large is outside the 1 ETH cap.
  if (budget / b > 700) return null
  const raised = Math.exp(budget / b)
  if (!Number.isFinite(raised)) return null
  const inside = 1 + (raised - 1) / p
  if (!(inside > 0) || !Number.isFinite(inside)) return null
  const delta = b * Math.log(inside)
  if (!Number.isFinite(delta) || delta <= 0) return null
  try {
    const qty = BigInt(Math.floor(delta))
    return qty > 0n ? qty : null
  } catch {
    return null
  }
}

/**
 * Pull `qty` down until the measured cost fits `targetWei`.
 * Marginal price only rises while buying, so removing dq tokens drops the
 * cost by at least p_start * dq. A miss larger than 2% is not rounding dust.
 */
export function qtyUnderMeasuredCost(
  qty: bigint,
  cost: bigint,
  targetWei: bigint,
  marginalPriceX64: bigint
): bigint | null {
  if (qty <= 0n) return null
  if (cost <= targetWei) return qty
  if (marginalPriceX64 <= 0n || targetWei <= 0n) return null
  const over = cost - targetWei
  if (over * 50n > targetWei) return null
  const dq = (over * PRICE_X64) / marginalPriceX64 + 1n + 1024n
  if (dq >= qty) return null
  return qty - dq
}

/**
 * Confirm a spot estimate with one cost read. A short correction covers float
 * rounding that missed the 98% band. Returns null when the estimate is too
 * far off for that check (the probe search takes over).
 * Never returns a qty whose measured cost was above `targetWei`.
 */
export async function acceptSpotQuote(
  costFn: (qty: bigint) => Promise<bigint>,
  targetWei: bigint,
  estimate: bigint,
  marginalPriceX64: bigint
): Promise<bigint | null> {
  if (targetWei <= 0n || estimate <= 0n) return null
  // 1 ppm plus a little wei keeps float rounding on the affordable side of
  // the budget. The live LMSR inverse was over by <10 wei; this shave is larger.
  const safety = estimate / 1_000_000n + 1024n
  const qty = estimate > safety ? estimate - safety : estimate
  if (qty <= 0n) return null
  const cost = await costFn(qty)
  if (cost > 0n && cost <= targetWei && costIsClose(cost, targetWei)) return qty
  if (cost > targetWei) {
    const shaved = qtyUnderMeasuredCost(qty, cost, targetWei, marginalPriceX64)
    if (shaved == null) return null
    const shavedCost = await costFn(shaved)
    if (shavedCost > 0n && shavedCost <= targetWei && costIsClose(shavedCost, targetWei)) {
      return shaved
    }
    return null
  }
  if (cost <= 0n) return null
  const grown = (targetWei * qty) / cost
  if (grown <= qty) return null
  const grownCost = await costFn(grown)
  if (grownCost > 0n && grownCost <= targetWei && costIsClose(grownCost, targetWei)) return grown
  if (grownCost > targetWei) {
    const mid = await bisectAffordableQty(costFn, qty, grown, targetWei, 4)
    const midCost = await costFn(mid)
    if (midCost > 0n && midCost <= targetWei && costIsClose(midCost, targetWei)) return mid
  }
  return null
}

/**
 * Affordable qty from a few cost reads.
 * LMSR cost is convex and zero at zero, so `qty * budget / cost(qty)` is an
 * upper bound. A chord under that bound raises the floor, then a short
 * bisection lands near the budget. The exact wei search needed dozens of
 * sequential RPC calls and left the bet button on "Quoting…".
 * Never returns a qty whose measured cost was above `targetWei`.
 */
export async function quoteQtyByProbing(
  costFn: (qty: bigint) => Promise<bigint>,
  targetWei: bigint
): Promise<bigint> {
  if (targetWei <= 0n) return 0n
  const probe = targetWei > 10n ** 15n ? 10n ** 15n : targetWei
  const probeCost = await costFn(probe)
  if (probeCost <= 0n) return 0n
  if (probeCost > targetWei) {
    return bisectAffordableQty(costFn, 0n, probe, targetWei, 8)
  }
  // probe === targetWei only means this quantity was affordable. LMSR cost is
  // at most the quantity, so a small budget (the probe is the whole budget)
  // can still buy many more shares. Keep searching unless the cost is close.
  if (costIsClose(probeCost, targetWei)) return probe

  let lo = probe
  let loCost = probeCost
  let hi = (targetWei * lo) / loCost
  if (hi <= lo) return lo
  const hiCost = await costFn(hi)
  if (hiCost <= 0n) return 0n
  if (hiCost <= targetWei) {
    if (costIsClose(hiCost, targetWei)) return hi
    let upper = hi
    lo = hi
    for (let k = 0; k < 3; k++) {
      const next = upper * 2n
      const nextCost = await costFn(next)
      if (nextCost <= 0n) return lo
      if (nextCost > targetWei) {
        return bisectAffordableQty(costFn, lo, next, targetWei, 6)
      }
      lo = next
      upper = next
      if (costIsClose(nextCost, targetWei)) return lo
    }
    return lo
  }

  const rise = hiCost - probeCost
  if (rise > 0n && hi > probe) {
    const guess = probe + ((hi - probe) * (targetWei - probeCost)) / rise
    if (guess > probe && guess < hi) {
      const guessCost = await costFn(guess)
      if (guessCost <= 0n) return probe
      if (guessCost <= targetWei) {
        if (costIsClose(guessCost, targetWei)) return guess
        lo = guess
        loCost = guessCost
        const tightened = (targetWei * lo) / loCost
        if (tightened > lo && tightened < hi) {
          const tightenedCost = await costFn(tightened)
          if (tightenedCost <= 0n) return lo
          if (tightenedCost <= targetWei) {
            if (costIsClose(tightenedCost, targetWei)) return tightened
            lo = tightened
          } else {
            hi = tightened
          }
        }
      } else {
        hi = guess
      }
    }
  }
  return bisectAffordableQty(costFn, lo, hi, targetWei, 6)
}
