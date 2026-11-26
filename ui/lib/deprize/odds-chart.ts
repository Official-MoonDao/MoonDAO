// Pure odds-chart domain / series helpers. Kept dependency-free so the mocha
// unit runner can cover the X-axis rules without mounting Recharts.

export type OddsSample = { t: number; p: number[] }

export const ODDS_X_TICK_COUNT = 5
/** Minimum window so a single (or tightly clustered) sample still gets a readable axis. */
export const ODDS_MIN_SPAN_MS = 5 * 60 * 1000
export const ODDS_DAY_MS = 24 * 60 * 60 * 1000
export const ODDS_HOUR_MS = 60 * 60 * 1000
export const ODDS_RESAMPLE_POINTS = 60

export type OddsTimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'

export const ODDS_TIME_RANGES: { id: OddsTimeRange; label: string; ms: number | null }[] = [
  { id: '1H', label: '1H', ms: ODDS_HOUR_MS },
  { id: '6H', label: '6H', ms: 6 * ODDS_HOUR_MS },
  { id: '1D', label: '1D', ms: ODDS_DAY_MS },
  { id: '1W', label: '1W', ms: 7 * ODDS_DAY_MS },
  { id: '1M', label: '1M', ms: 30 * ODDS_DAY_MS },
  { id: 'ALL', label: 'ALL', ms: null },
]

export type OddsTimeDomain = {
  tMin: number
  tMax: number
  ticks: number[]
  spanMs: number
}

const SUB_DAY_STEPS_MS = [
  60 * 1000, // 1m
  2 * 60 * 1000, // 2m
  5 * 60 * 1000, // 5m
  10 * 60 * 1000, // 10m
  15 * 60 * 1000, // 15m
  30 * 60 * 1000, // 30m
  ODDS_HOUR_MS, // 1h
  2 * ODDS_HOUR_MS, // 2h
  3 * ODDS_HOUR_MS, // 3h
  4 * ODDS_HOUR_MS, // 4h
  6 * ODDS_HOUR_MS, // 6h
  8 * ODDS_HOUR_MS, // 8h
  12 * ODDS_HOUR_MS, // 12h
]

function buildTicksForSpan(tMin: number, tMax: number): number[] {
  const span = tMax - tMin
  if (span >= ODDS_DAY_MS * 2) return calendarDayTicks(tMin, tMax)
  return niceSubDayTicks(tMin, tMax)
}

/**
 * Snap sub-2-day X ticks to clean local clock boundaries (e.g. 12 AM, 4 AM,
 * 8 AM or :00/:15/:30/:45) instead of arbitrary off-the-minute timestamps.
 */
function niceSubDayTicks(tMin: number, tMax: number): number[] {
  const span = tMax - tMin
  const step =
    SUB_DAY_STEPS_MS.find((s) => span / s <= 6) ?? SUB_DAY_STEPS_MS[SUB_DAY_STEPS_MS.length - 1]
  const anchor = localDayStart(tMin)
  const firstStep = Math.ceil((tMin - anchor) / step)
  const ticks: number[] = []
  for (let t = anchor + firstStep * step; t <= tMax; t += step) {
    ticks.push(t)
    if (ticks.length > 12) break
  }
  if (ticks.length >= 2) return ticks
  return Array.from({ length: ODDS_X_TICK_COUNT }, (_, i) =>
    Math.round(tMin + (span * i) / (ODDS_X_TICK_COUNT - 1)),
  )
}

/**
 * Build an X-axis domain that spans the exact data range (market open → now)
 * with clean clock-aligned ticks. No calendar snapping of the domain bounds —
 * that used to invent dead space before the market opened.
 */
export function buildOddsTimeDomain(
  history: OddsSample[],
  domainStartMs?: number,
  nowMs: number = Date.now(),
): OddsTimeDomain {
  if (!history.length) {
    return { tMin: 0, tMax: 0, ticks: [], spanMs: 0 }
  }

  const times = history.map((s) => s.t)
  const tMax = Math.max(...times, nowMs)
  let tMin =
    domainStartMs !== undefined && Number.isFinite(domainStartMs)
      ? Math.min(domainStartMs, ...times)
      : Math.min(...times)
  if (tMax - tMin < ODDS_MIN_SPAN_MS) {
    tMin = tMax - ODDS_MIN_SPAN_MS
  }

  const span = tMax - tMin
  const ticks = buildTicksForSpan(tMin, tMax)
  return { tMin, tMax, ticks, spanMs: span }
}

/** Timeframes meaningful for a market's total span (always includes ALL). */
export function availableOddsRanges(totalSpanMs: number): OddsTimeRange[] {
  const ranges: OddsTimeRange[] = []
  for (const r of ODDS_TIME_RANGES) {
    if (r.ms === null || totalSpanMs > r.ms / 0.85) {
      ranges.push(r.id)
    }
  }
  return ranges
}

/** Build an X-axis domain zoomed to a selected timeframe ending at `tMax`. */
export function sliceOddsTimeDomain(
  history: OddsSample[],
  range: OddsTimeRange,
  domainStartMs?: number,
  nowMs: number = Date.now(),
): OddsTimeDomain {
  const full = buildOddsTimeDomain(history, domainStartMs, nowMs)
  if (!history.length || range === 'ALL') return full
  const spec = ODDS_TIME_RANGES.find((r) => r.id === range)
  if (!spec?.ms) return full
  const tMax = full.tMax
  const tMin = Math.max(full.tMin, tMax - spec.ms)
  const spanMs = tMax - tMin
  if (spanMs <= 0) return full
  return {
    tMin,
    tMax,
    ticks: buildTicksForSpan(tMin, tMax),
    spanMs,
  }
}

/**
 * Exact time-weighted average of the piecewise-constant LMSR series over [a, b].
 * Anti-aliases sub-bucket trade bursts regardless of where they fall relative
 * to grid boundaries, preserves probability sums (= 100%), and never overshoots.
 */
function timeWeightedAverage(
  sorted: OddsSample[],
  startIdx: number,
  a: number,
  b: number,
): number[] {
  const n = sorted[startIdx].p.length
  const acc = new Array<number>(n).fill(0)
  const total = b - a
  if (total <= 0) return sorted[startIdx].p

  let idx = startIdx
  let cursor = a
  while (idx + 1 < sorted.length && sorted[idx + 1].t < b) {
    const nextT = sorted[idx + 1].t
    if (nextT > cursor) {
      const w = nextT - cursor
      const p = sorted[idx].p
      for (let i = 0; i < n; i++) acc[i] += p[i] * w
      cursor = nextT
    }
    idx++
  }
  const rem = b - cursor
  if (rem > 0) {
    const p = sorted[idx].p
    for (let i = 0; i < n; i++) acc[i] += p[i] * rem
  }
  for (let i = 0; i < n; i++) acc[i] /= total
  return acc
}

/**
 * Resample the piecewise-constant LMSR odds series onto an evenly spaced time
 * grid across `domain` using centered time-weighted bucket averages (with exact
 * opening and live endpoint values).
 *
 * 1. Brief burst spikes within a bucket are anti-aliased cleanly instead of
 *    rendering as single-pixel vertical needles.
 * 2. Even grid spacing keeps smooth monotone curves faithful (flat intervals
 *    stay flat; sustained shifts ease smoothly right around the trade time) and
 *    makes hover scrubbing continuous across the entire chart.
 */
export function resampleOddsHistory(
  history: OddsSample[],
  domain: OddsTimeDomain,
  points: number = ODDS_RESAMPLE_POINTS,
): OddsSample[] {
  if (!history.length) return []
  const sorted = [...history].sort((a, b) => a.t - b.t)
  if (domain.spanMs <= 0 || points < 2) return padOddsSamples(sorted, domain)

  const out: OddsSample[] = []
  const dt = domain.spanMs / points
  const halfDt = dt / 2

  let startIdx = 0
  while (startIdx + 1 < sorted.length && sorted[startIdx + 1].t <= domain.tMin) {
    startIdx++
  }
  let endIdx = startIdx
  while (endIdx + 1 < sorted.length && sorted[endIdx + 1].t <= domain.tMax) {
    endIdx++
  }

  // Exact opening value at domain.tMin
  out.push({ t: domain.tMin, p: sorted[startIdx].p })

  // Interior grid points: centered time-weighted average over [t - dt/2, t + dt/2]
  let winIdx = startIdx
  for (let k = 1; k < points; k++) {
    const t = Math.round(domain.tMin + dt * k)
    const a = Math.max(domain.tMin, t - halfDt)
    const b = Math.min(domain.tMax, t + halfDt)
    while (winIdx + 1 < sorted.length && sorted[winIdx + 1].t <= a) {
      winIdx++
    }
    out.push({ t, p: timeWeightedAverage(sorted, winIdx, a, b) })
  }

  // Exact live endpoint at domain.tMax
  out.push({ t: domain.tMax, p: sorted[endIdx].p })
  return out
}

export type OddsValueDomain = { min: number; max: number; ticks: number[] }

const ODDS_Y_FULL: OddsValueDomain = { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }
/** Narrowest Y window (percentage points), so near-flat odds are not blown up. */
export const ODDS_MIN_Y_SPAN = 10
const ODDS_Y_STEPS = [1, 2, 5, 10, 20, 25]
const ODDS_Y_TARGET_TICKS = 5

/**
 * Fit the Y axis to the plotted odds instead of a fixed 0–100, so outcomes
 * that sit close together stay distinguishable. Bounds snap to a round tick
 * step and never leave 0–100.
 */
export function buildOddsValueDomain(history: OddsSample[], outcomeCount: number): OddsValueDomain {
  let lo = Infinity
  let hi = -Infinity
  for (const s of history) {
    for (let i = 0; i < outcomeCount; i++) {
      const v = s.p[i]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (lo === Infinity) return ODDS_Y_FULL

  const pad = Math.max((hi - lo) * 0.15, 1)
  let min = Math.max(0, lo - pad)
  let max = Math.min(100, hi + pad)
  if (max - min < ODDS_MIN_Y_SPAN) {
    const mid = (min + max) / 2
    min = mid - ODDS_MIN_Y_SPAN / 2
    max = mid + ODDS_MIN_Y_SPAN / 2
    if (min < 0) [min, max] = [0, ODDS_MIN_Y_SPAN]
    if (max > 100) [min, max] = [100 - ODDS_MIN_Y_SPAN, 100]
  }

  const rough = (max - min) / (ODDS_Y_TARGET_TICKS - 1)
  const step = ODDS_Y_STEPS.find((s) => s >= rough) ?? 25
  const snappedMin = Math.max(0, Math.floor(min / step) * step)
  const snappedMax = Math.min(100, Math.ceil(max / step) * step)
  if (snappedMax - snappedMin >= 100) return ODDS_Y_FULL

  const ticks: number[] = []
  for (let t = snappedMin; t <= snappedMax + 1e-9; t += step) ticks.push(t)
  return { min: snappedMin, max: snappedMax, ticks }
}

/** One label per local calendar day, so a multi-day axis cannot skip a date. */
function calendarDayTicks(tMin: number, tMax: number): number[] {
  const days: number[] = []
  for (let day = localDayStart(tMin); day <= localDayStart(tMax); day = nextLocalDay(day)) {
    days.push(day)
    if (days.length > 400) break
  }
  const maxLabels = 8
  const step = Math.max(1, Math.ceil(days.length / maxLabels))
  const picked: number[] = []
  for (let i = 0; i < days.length; i += step) picked.push(days[i])
  const last = days[days.length - 1]
  if (last !== undefined && picked[picked.length - 1] !== last) picked.push(last)
  const noon = 12 * 60 * 60 * 1000
  return picked.map((day) => Math.min(tMax, Math.max(tMin, day + noon)))
}

function localDayStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function nextLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Extend the series to both domain edges so the plotted line has no dead
 * space at either side of the chart.
 */
export function padOddsSamples(
  history: OddsSample[],
  domain: OddsTimeDomain,
): OddsSample[] {
  if (!history.length) return []
  const first = history[0]
  const last = history[history.length - 1]
  let samples = history
  if (first.t > domain.tMin) {
    samples = [{ t: domain.tMin, p: first.p }, ...samples]
  }
  if (last.t < domain.tMax) {
    samples = [...samples, { t: domain.tMax, p: last.p }]
  }
  if (samples.length === 1) {
    samples = [samples[0], { t: domain.tMax, p: samples[0].p }]
  }
  return samples
}

export function formatOddsTick(t: number, spanMs: number): string {
  const d = new Date(t)
  // A window of about a day has five ticks that share a calendar date. The
  // hour keeps those labels from repeating "Sep 22" across the axis.
  if (spanMs >= ODDS_DAY_MS * 2) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  if (spanMs >= ODDS_DAY_MS) {
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' })
  }
  if (spanMs >= 3 * ODDS_HOUR_MS && d.getMinutes() === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric' })
  }
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatOddsTooltip(t: number, spanMs: number): string {
  const d = new Date(t)
  if (spanMs >= ODDS_HOUR_MS) {
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  if (spanMs >= 15 * 60 * 1000) {
    return d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}
