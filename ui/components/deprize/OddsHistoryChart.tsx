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
import {
  buildOddsTimeDomain,
  formatOddsTick,
  formatOddsTooltip,
  padOddsSamples,
  type OddsSample,
} from '@/lib/deprize/odds-chart'

export type { OddsSample }

type Props = {
  history: OddsSample[]
  labels: string[]
  colors: string[]
  height?: number
  /** Anchor the X domain to the market open time (ms since epoch). */
  domainStartMs?: number
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

    const domain = buildOddsTimeDomain(history, domainStartMs)
    const samples = padOddsSamples(history, domain)

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
          tickFormatter={(t) => formatOddsTick(Number(t), spanMs)}
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
          labelFormatter={(t) => formatOddsTooltip(Number(t), spanMs)}
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
