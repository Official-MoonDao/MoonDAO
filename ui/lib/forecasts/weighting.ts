/** Live √vMOONEY weighting for DePrize forecast votes. */

export const FORECAST_MAX_WEIGHT_SHARE = 0.15

/** Sentinel used when a batched balance read failed. Not a real zero. */
export const VMOONEY_UNAVAILABLE = Number.POSITIVE_INFINITY

export function votingWeight(vmooney: number): number {
  if (!Number.isFinite(vmooney) || vmooney <= 0) return 0
  return Math.sqrt(vmooney)
}

export function votingWeightFromBalances(balances: readonly number[]): number {
  let sum = 0
  for (const value of balances) {
    if (Number.isFinite(value) && value > 0) sum += value
  }
  return votingWeight(sum)
}

export function resolveVmooney(live: number, stored: number): number {
  return Number.isFinite(live) ? live : stored
}

export function capWeights(weights: readonly number[], maxShare: number): number[] {
  const n = weights.length
  if (n === 0) return []

  const cleaned = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const total = cleaned.reduce((acc, w) => acc + w, 0)
  if (total <= 0 || !(maxShare > 0) || n * maxShare < 1 - 1e-12) {
    return Array.from({ length: n }, () => 1 / n)
  }

  const capped = new Array<boolean>(n).fill(false)
  let remainingMass = 1
  let remainingWeight = total
  let progress = true
  while (progress) {
    progress = false
    for (let i = 0; i < n; i++) {
      if (capped[i] || cleaned[i] <= 0 || remainingWeight <= 0) continue
      const share = (cleaned[i] / remainingWeight) * remainingMass
      if (share > maxShare + 1e-12) {
        capped[i] = true
        remainingMass -= maxShare
        remainingWeight -= cleaned[i]
        progress = true
      }
    }
  }

  return cleaned.map((w, i) => {
    if (capped[i]) return maxShare
    if (remainingWeight <= 0) return 0
    return (w / remainingWeight) * remainingMass
  })
}

/**
 * Outcome shares from live voting power. A zero stays zero, so a wallet with
 * no voting power is counted as a person and cannot move the distribution.
 */
export function sharesForVotingPower(weights: readonly number[], maxShare: number): number[] {
  const indexes: number[] = []
  const positive: number[] = []
  weights.forEach((weight, index) => {
    if (Number.isFinite(weight) && weight > 0) {
      indexes.push(index)
      positive.push(weight)
    }
  })
  const shares = weights.map(() => 0)
  if (positive.length === 0) return shares
  const capped = capWeights(positive, maxShare)
  indexes.forEach((index, i) => {
    shares[index] = capped[i] ?? 0
  })
  return shares
}
