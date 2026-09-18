import {
  FORECAST_WEIGHT_MAX,
  FORECAST_WEIGHT_MAX_LEN,
  FORECAST_WEIGHT_MIN_LEN,
} from './constants'

export type WeightsReject =
  | 'length'
  | 'non-finite'
  | 'negative'
  | 'too-large'
  | 'all-zero'

export function validateWeights(
  weights: unknown
): { ok: true; weights: number[] } | { ok: false; rule: WeightsReject } {
  if (!Array.isArray(weights)) return { ok: false, rule: 'length' }
  if (weights.length < FORECAST_WEIGHT_MIN_LEN || weights.length > FORECAST_WEIGHT_MAX_LEN) {
    return { ok: false, rule: 'length' }
  }
  const out: number[] = []
  for (const value of weights) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, rule: 'non-finite' }
    }
    if (value < 0) return { ok: false, rule: 'negative' }
    if (value > FORECAST_WEIGHT_MAX) return { ok: false, rule: 'too-large' }
    out.push(value)
  }
  if (!out.some((w) => w > 0)) return { ok: false, rule: 'all-zero' }
  return { ok: true, weights: out }
}

export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0)
  return weights.map((w) => w / sum)
}

/** Integer percents that sum to 100. */
export function evenPercents(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n)
  const out = Array.from({ length: n }, () => base)
  out[n - 1] += 100 - base * n
  return out
}

export function weightsToPercents(weights: number[]): number[] {
  if (!weights.length || !weights.some((w) => w > 0)) {
    return evenPercents(weights.length)
  }
  return normalizeWeights(weights).map((w) => Math.round(w * 100))
}

export function percentsDiverged(percents: number[], n: number): boolean {
  const even = evenPercents(n)
  if (percents.length !== even.length) return true
  return percents.some((value, i) => value !== even[i])
}

export function serializeLatest(
  weights: number[],
  at: string
): { v: 1; vector: number[]; updatedAt: string; weights: number[] } {
  return {
    v: 1,
    vector: normalizeWeights(weights),
    updatedAt: at,
    weights,
  }
}
