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
