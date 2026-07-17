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
}

const X_TICK_COUNT = 5
/** Minimum window so a single (or tightly clustered) sample still gets a readable axis. */
const MIN_SPAN_MS = 5 * 60 * 1000
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
  24 * 60 * 60_000,
] as const

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtTimeFull = (t: number) =>
  new Date(t).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })

function niceStepMs(span: number, tickCount: number): number {
  const target = span / Math.max(1, tickCount - 1)
  return (
    NICE_STEP_MS.find((step) => step >= target) ??
    NICE_STEP_MS[NICE_STEP_MS.length - 1]
  )
}

function buildTimeDomain(history: OddsSample[]): {
  tMin: number
  tMax: number
  ticks: number[]
} {
  const now = Date.now()
  const times = history.map((s) => s.t)
  let tMax = Math.max(...times, now)
  let tMin = Math.min(...times)
  if (tMax - tMin < MIN_SPAN_MS) {
    tMin = tMax - MIN_SPAN_MS
  }

  // Pick a nice equal time step, align the domain to that step, then emit
  // ticks at every step so labels never bunch on the left.
  const step = niceStepMs(tMax - tMin, X_TICK_COUNT)
  tMin = Math.floor(tMin / step) * step
  tMax = Math.ceil(tMax / step) * step
  if (tMax <= tMin) tMax = tMin + step * (X_TICK_COUNT - 1)
  // Prefer a stable ~5-tick axis: pad the end if alignment shrank the span.
  const minEnd = tMin + step * (X_TICK_COUNT - 1)
  if (tMax < minEnd) tMax = minEnd

  const ticks: number[] = []
  for (let t = tMin; t <= tMax + 1; t += step) {
    ticks.push(t)
  }
  return { tMin, tMax, ticks }
}

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
}: Props) {
  const outcomeCount = labels.length

  const { data, tMin, tMax, ticks } = useMemo(() => {
    if (!history.length) {
      return { data: [] as Record<string, number>[], tMin: 0, tMax: 0, ticks: [] as number[] }
    }

    const domain = buildTimeDomain(history)

    // Ensure the series spans the full domain so a single live reading still
    // draws across the chart (flat at current odds until more samples arrive).
    let samples = history
    if (history.length === 1) {
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
  }, [history, outcomeCount])

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
          tickFormatter={fmtTime}
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
          labelFormatter={(t) => fmtTimeFull(Number(t))}
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
