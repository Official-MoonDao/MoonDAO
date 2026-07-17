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

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const fmtTimeFull = (t: number) =>
  new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
}: Props) {
  const outcomeCount = labels.length

  // recharts wants flat rows: { t, v0, v1, ... }. With a single live sample,
  // synthesize a short baseline so the current odds still plot immediately.
  const samples =
    history.length === 1
      ? [{ t: history[0].t - 60_000, p: history[0].p }, history[0]]
      : history
  const data = samples.map((s) => {
    const row: Record<string, number> = { t: s.t }
    for (let i = 0; i < outcomeCount; i++) row[`v${i}`] = s.p[i]
    return row
  })

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
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#ffffff12" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={fmtTime}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#ffffff22"
          minTickGap={40}
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
