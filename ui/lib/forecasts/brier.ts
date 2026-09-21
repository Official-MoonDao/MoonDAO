export function snapshotBrier(
  forecast: number[],
  resolved: number[] | null | undefined
): number | null {
  if (!resolved || resolved.length !== forecast.length) return null
  try {
    return brierScore(forecast, resolved)
  } catch {
    return null
  }
}

export function brierScore(forecast: number[], outcome: number[]): number {
  if (forecast.length !== outcome.length) {
    throw new Error('brier-length-mismatch')
  }
  let sum = 0
  for (let i = 0; i < forecast.length; i++) {
    const d = forecast[i] - outcome[i]
    sum += d * d
  }
  return sum
}

export function uniformBaselineBrier(outcome: number[]): number {
  const n = outcome.length
  if (n === 0) throw new Error('brier-length-mismatch')
  const uniform = Array.from({ length: n }, () => 1 / n)
  return brierScore(uniform, outcome)
}

export function brierSkillScore(brier: number, outcome: number[]): number | null {
  const baseline = uniformBaselineBrier(outcome)
  if (baseline === 0) return null
  return 1 - brier / baseline
}

/** Integer leftover-on-last split of 100, the UI's encoding of "even". */
function evenIntegerPercents(n: number): number[] {
  const base = Math.floor(100 / n)
  const out = Array.from({ length: n }, () => base)
  out[n - 1] += 100 - base * n
  return out
}

function allocationAsProbabilities(allocation: number[]): number[] | null {
  if (!Array.isArray(allocation) || allocation.length === 0) return null
  const sum = allocation.reduce((acc, value) => acc + value, 0)
  if (!(sum > 0)) return null
  const even = evenIntegerPercents(allocation.length)
  if (
    allocation.length === even.length &&
    allocation.every((value, i) => value === even[i])
  ) {
    return Array.from({ length: allocation.length }, () => 1 / allocation.length)
  }
  return allocation.map((value) => value / sum)
}

export function scoreAllocation(
  allocation: number[],
  resolved: number[] | null | undefined
): { brier: number; skill: number | null } | null {
  if (!resolved || resolved.length !== allocation.length) return null
  const vector = allocationAsProbabilities(allocation)
  if (!vector) return null
  try {
    const brier = brierScore(vector, resolved)
    return { brier, skill: brierSkillScore(brier, resolved) }
  } catch {
    return null
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo)
}

export function crowdAggregate(
  latestByUser: Array<{ userId: string; vector: number[] }>,
  excludeUserId?: string
): { vector: number[]; count: number; p25: number[]; p75: number[] } {
  const rows = latestByUser.filter((row) => row.userId !== excludeUserId && row.vector.length > 0)
  if (rows.length === 0) {
    return { vector: [], count: 0, p25: [], p75: [] }
  }
  const n = rows[0].vector.length
  const usable = rows.filter((row) => row.vector.length === n)
  const count = usable.length
  const vector = Array.from({ length: n }, (_, i) => {
    const sum = usable.reduce((acc, row) => acc + row.vector[i], 0)
    return sum / count
  })
  const p25 = Array.from({ length: n }, (_, i) => {
    const col = usable.map((row) => row.vector[i]).sort((a, b) => a - b)
    return percentile(col, 0.25)
  })
  const p75 = Array.from({ length: n }, (_, i) => {
    const col = usable.map((row) => row.vector[i]).sort((a, b) => a - b)
    return percentile(col, 0.75)
  })
  return { vector, count, p25, p75 }
}
