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
