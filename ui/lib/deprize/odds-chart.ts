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
  const ticks = Array.from({ length: ODDS_X_TICK_COUNT }, (_, i) =>
    Math.round(tMin + (span * i) / (ODDS_X_TICK_COUNT - 1)),
  )
  return { tMin, tMax, ticks, spanMs: span }
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
  if (spanMs >= ODDS_DAY_MS) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
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
