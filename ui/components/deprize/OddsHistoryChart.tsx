import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type OddsSample = { t: number; p: number[] }

type Props = {
  history: OddsSample[]
  labels: string[]
  colors: string[]
  height?: number
  /** Anchor the X domain to the market open time (ms since epoch). */
  domainStartMs?: number
}

const X_TICK_COUNT = 5
/** Minimum window so a single (or tightly clustered) sample still gets a readable axis. */
const MIN_SPAN_MS = 5 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
/** Nice equal increments for the X axis (ms). */
const NICE_STEP_MS = [
  60_000,
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  DAY_MS,
  2 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
] as const

function fmtTick(t: number, spanMs: number) {
  const d = new Date(t)
  if (spanMs >= DAY_MS) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtTooltip(t: number, spanMs: number) {
  const d = new Date(t)
  if (spanMs >= DAY_MS) {
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

function niceStepMs(span: number, tickCount: number): number {
  const target = span / Math.max(1, tickCount - 1)
  const found = NICE_STEP_MS.find((step) => step >= target)
  if (found) return found
  // Beyond the table: whole-day multiples.
  return Math.max(1, Math.ceil(target / DAY_MS)) * DAY_MS
}

function buildTimeDomain(
  history: OddsSample[],
  domainStartMs?: number,
): {
  tMin: number
  tMax: number
  ticks: number[]
  spanMs: number
} {
  const now = Date.now()
  const times = history.map((s) => s.t)
  let tMax = Math.max(...times, now)
  let tMin =
    domainStartMs !== undefined && Number.isFinite(domainStartMs)
      ? Math.min(domainStartMs, ...times)
      : Math.min(...times)
  if (tMax - tMin < MIN_SPAN_MS) {
    tMin = tMax - MIN_SPAN_MS
  }

  // Pick a nice equal time step, align the domain to that step, then emit
  // ticks at every step so labels never bunch on the left.
  const step = niceStepMs(tMax - tMin, X_TICK_COUNT)
  tMin = Math.floor(tMin / step) * step
  tMax = Math.ceil(tMax / step) * step
  if (tMax <= tMin) tMax = tMin + step * (X_TICK_COUNT - 1)
  // For short windows only, pad up to ~5 ticks. Never invent a large future
  // span past "now" on long-lived markets (that pushed labels into next month).
  const alignedTicks = Math.floor((tMax - tMin) / step) + 1
  if (alignedTicks < 3) {
    tMax = tMin + step * Math.max(2, X_TICK_COUNT - 1)
  }

  const ticks: number[] = []
  for (let t = tMin; t <= tMax + 1; t += step) {
    ticks.push(t)
  }
  // Guard against an oversized tick list if span/step misalign.
  const thinned =
    ticks.length <= 8
      ? ticks
      : Array.from(
          { length: X_TICK_COUNT },
          (_, i) => tMin + Math.round(((tMax - tMin) * i) / (X_TICK_COUNT - 1)),
        )
  return { tMin, tMax, ticks: thinned, spanMs: tMax - tMin }
}

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
  domainStartMs,
}: Props) {
  const outcomeCount = labels.length

  const { data, tMin, tMax, ticks, spanMs } = useMemo(() => {
    if (!history.length) {
      return {
        data: [] as Record<string, number>[],
        tMin: 0,
        tMax: 0,
        ticks: [] as number[],
        spanMs: 0,
      }
    }

    const domain = buildTimeDomain(history, domainStartMs)
    const anchored =
      domainStartMs !== undefined && Number.isFinite(domainStartMs)

    // With a market-open anchor, plot real samples only and extend the last
    // point to "now" — do not invent a flat history back to open. Without an
    // anchor (short live window), keep the prior baseline so a single reading
    // still draws immediately.
    let samples = history
    if (anchored) {
      const last = history[history.length - 1]
      if (last && last.t < domain.tMax) {
        samples = [...history, { t: domain.tMax, p: last.p }]
      }
      if (samples.length === 1) {
        samples = [
          samples[0],
          { t: Math.min(samples[0].t + 1, domain.tMax), p: samples[0].p },
        ]
      }
    } else if (history.length === 1) {
      samples = [
        { t: domain.tMin, p: history[0].p },
        { t: domain.tMax, p: history[0].p },
      ]
    } else {
      const first = history[0]
      const last = history[history.length - 1]
      samples = history
      if (first.t > domain.tMin) {
        samples = [{ t: domain.tMin, p: first.p }, ...samples]
      }
      if (last.t < domain.tMax) {
        samples = [...samples, { t: domain.tMax, p: last.p }]
      }
    }

    const rows = samples.map((s) => {
      const row: Record<string, number> = { t: s.t }
      for (let i = 0; i < outcomeCount; i++) row[`v${i}`] = s.p[i]
      return row
    })

    return { data: rows, ...domain }
  }, [history, outcomeCount, domainStartMs])

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-xs text-center px-4"
        style={{ height }}
      >
        Live odds will plot here as the market updates. Leave this open (or place
        a bet) and the chart fills in over time.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
        <CartesianGrid stroke="#ffffff12" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="linear"
          domain={[tMin, tMax]}
          ticks={ticks}
          tickFormatter={(t) => fmtTick(Number(t), spanMs)}
          tick={{ fill: '#9ca3af', fontSize: 11, textAnchor: 'middle' }}
          stroke="#ffffff22"
          interval={0}
          minTickGap={0}
          padding={{ left: 8, right: 8 }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#ffffff22"
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: '#0b1220',
            border: '1px solid #ffffff22',
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: '#9ca3af' }}
          labelFormatter={(t) => fmtTooltip(Number(t), spanMs)}
          formatter={(value: any, _name, item) => {
            const idx = Number(String(item?.dataKey).replace('v', ''))
            return [`${Number(value).toFixed(1)}%`, labels[idx]]
          }}
        />
        {Array.from({ length: outcomeCount }, (_, i) => (
          <Line
            key={i}
            type="monotone"
            dataKey={`v${i}`}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
