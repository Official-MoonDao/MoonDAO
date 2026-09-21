/** Log-linear pooling of the market and DAO forecast distributions. */

export const MARKET_EVIDENCE_REF_ETH = 10
export const DAO_EVIDENCE_REF = 100

export type PoolSeries = {
  p: number[]
  weight: number
}

const DEFAULT_EPS = 1e-6

export function marketEvidence(collateralEth: number, isLiveMarket: boolean): number {
  if (!isLiveMarket) return 0
  if (!Number.isFinite(collateralEth) || collateralEth <= 0) return 0
  return Math.min(1, collateralEth / MARKET_EVIDENCE_REF_ETH)
}

export function daoEvidence(totalWeight: number): number {
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return 0
  return Math.min(1, totalWeight / DAO_EVIDENCE_REF)
}

export function logLinearPool(
  series: readonly PoolSeries[],
  eps: number = DEFAULT_EPS
): number[] | null {
  const usable = series.filter(
    (s) => s && Array.isArray(s.p) && s.p.length > 0 && Number.isFinite(s.weight) && s.weight > 0
  )
  if (usable.length === 0) return null

  const n = usable[0].p.length
  const floor = Number.isFinite(eps) && eps > 0 ? eps : DEFAULT_EPS
  const weightSum = usable.reduce((acc, s) => acc + s.weight, 0)
  if (!(weightSum > 0)) return null
  const raw = Array.from({ length: n }, () => 0)

  for (let i = 0; i < n; i++) {
    let logP = 0
    for (const s of usable) {
      const p = Math.max(floor, s.p[i] ?? 0)
      logP += (s.weight / weightSum) * Math.log(p)
    }
    raw[i] = Math.exp(logP)
  }

  const sum = raw.reduce((acc, value) => acc + value, 0)
  if (!(sum > 0)) return null
  return raw.map((value) => value / sum)
}
