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
  // Domain edges are the *exact* data range: start at market open (when known)
  // or the first sample, end at "now" / the latest sample. No calendar snapping,
  // so the axis never begins before the market did (that left dead space on the
  // left where no line was drawn).
  let tMax = Math.max(...times, now)
  let tMin =
    domainStartMs !== undefined && Number.isFinite(domainStartMs)
      ? Math.min(domainStartMs, ...times)
      : Math.min(...times)
  if (tMax - tMin < MIN_SPAN_MS) {
    tMin = tMax - MIN_SPAN_MS
  }

  // Evenly divide the real range into equal increments. First tick sits exactly
  // at tMin and the last exactly at tMax, so ticks fill the full width with
  // uniform spacing and zero dead space at either edge.
  const span = tMax - tMin
  const ticks = Array.from({ length: X_TICK_COUNT }, (_, i) =>
    Math.round(tMin + (span * i) / (X_TICK_COUNT - 1)),
  )
  return { tMin, tMax, ticks, spanMs: span }
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

    // Draw a continuous line across the whole domain so there is no dead space
    // at either edge: extend the earliest sample back to tMin and the latest
    // forward to tMax (flat holds — we only have odds for the sampled window,
    // and the caption makes that explicit).
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
