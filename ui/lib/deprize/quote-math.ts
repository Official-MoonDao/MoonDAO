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
