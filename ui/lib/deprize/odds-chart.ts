// Pure odds-chart domain / series helpers. Kept dependency-free so the mocha
// unit runner can cover the X-axis rules without mounting Recharts.

export type OddsSample = { t: number; p: number[] }

export const ODDS_X_TICK_COUNT = 5
/** Minimum window so a single (or tightly clustered) sample still gets a readable axis. */
export const ODDS_MIN_SPAN_MS = 5 * 60 * 1000
export const ODDS_DAY_MS = 24 * 60 * 60 * 1000

export type OddsTimeDomain = {
  tMin: number
  tMax: number
  ticks: number[]
  spanMs: number
}

/**
 * Build an X-axis domain that spans the exact data range (market open → now)
 * with equal-interval ticks. No calendar snapping — that used to invent dead
 * space before the market opened.
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
  let tMax = Math.max(...times, nowMs)
  let tMin =
    domainStartMs !== undefined && Number.isFinite(domainStartMs)
      ? Math.min(domainStartMs, ...times)
      : Math.min(...times)
  if (tMax - tMin < ODDS_MIN_SPAN_MS) {
    tMin = tMax - ODDS_MIN_SPAN_MS
  }

  const span = tMax - tMin
  const ticks =
    span >= ODDS_DAY_MS * 2
      ? calendarDayTicks(tMin, tMax)
      : Array.from({ length: ODDS_X_TICK_COUNT }, (_, i) =>
          Math.round(tMin + (span * i) / (ODDS_X_TICK_COUNT - 1)),
        )
  return { tMin, tMax, ticks, spanMs: span }
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
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatOddsTooltip(t: number, spanMs: number): string {
  const d = new Date(t)
  if (spanMs >= ODDS_DAY_MS) {
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
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
