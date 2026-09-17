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

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function startOfNextUtcDayMs(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) + 86_400_000
}

function addUtcDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

function standingAtEndOfDay(
  surviving: Array<{ at: string; vector: number[] }>,
  day: string
): number[] | undefined {
  const cutoff = startOfNextUtcDayMs(day)
  let chosen: number[] | undefined
  for (const entry of surviving) {
    if (Date.parse(entry.at) < cutoff) chosen = entry.vector
  }
  return chosen
}

export function timeAveragedBrier(
  forecastHistory: Array<{ at: string; vector: number[] }>,
  resolvedAt: string,
  resolvedVector: number[]
): { brier: number; daysScored: number; calls: number } | null {
  const resolvedMs = Date.parse(resolvedAt)
  const surviving = forecastHistory.filter((entry) => Date.parse(entry.at) < resolvedMs)
  if (surviving.length === 0) return null

  const firstDay = surviving.reduce((min, entry) => {
    const day = utcDay(entry.at)
    return day < min ? day : min
  }, utcDay(surviving[0].at))
  const lastDay = addUtcDays(utcDay(resolvedAt), -1)
  if (lastDay < firstDay) return null

  const days: string[] = []
  for (let day = firstDay; day <= lastDay; day = addUtcDays(day, 1)) {
    days.push(day)
  }

  let total = 0
  for (const day of days) {
    const standing = standingAtEndOfDay(surviving, day)
    if (!standing) return null
    total += brierScore(standing, resolvedVector)
  }

  return {
    brier: total / days.length,
    daysScored: days.length,
    calls: surviving.length,
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
