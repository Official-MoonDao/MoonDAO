import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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

export type OddsMarker = { t: number; index: number; buy?: boolean }

type Props = {
  history: OddsSample[]
  labels: string[]
  colors: string[]
  height?: number
  /** Anchor the X domain to the market open time (ms since epoch). */
  domainStartMs?: number
  /** One dot per on-chain trade, drawn on the traded outcome's line. */
  markers?: OddsMarker[]
  /** True while the on-chain history is still loading. */
  loading?: boolean
}

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
  domainStartMs,
  markers = [],
  loading = false,
}: Props) {
  const outcomeCount = labels.length

  const { data, tMin, tMax, ticks, spanMs, dots } = useMemo(() => {
    if (!history.length) {
      return {
        data: [] as Record<string, number>[],
        tMin: 0,
        tMax: 0,
        ticks: [] as number[],
        spanMs: 0,
        dots: [] as { t: number; v: number; index: number; buy: boolean }[],
      }
    }

    const domain = buildOddsTimeDomain(history, domainStartMs)
    const samples = padOddsSamples(history, domain)

    const rows = samples.map((s) => {
      const row: Record<string, number> = { t: s.t }
      for (let i = 0; i < outcomeCount; i++) row[`v${i}`] = s.p[i]
      return row
    })

    // Marker y-value = the traded outcome's probability right after the trade
    // (the latest sample at or before the marker time). Buys render filled;
    // cash-outs render hollow so sells read differently from bets.
    const sorted = [...history].sort((a, b) => a.t - b.t)
    const dots = markers
      .map((m) => {
        let v: number | undefined
        for (const s of sorted) {
          if (s.t <= m.t) v = s.p[m.index]
          else break
        }
        return v === undefined || !Number.isFinite(v)
          ? null
          : { t: Math.max(m.t, domain.tMin), v, index: m.index, buy: m.buy !== false }
      })
      .filter((d): d is { t: number; v: number; index: number; buy: boolean } => d !== null)

    return { data: rows, dots, ...domain }
  }, [history, outcomeCount, domainStartMs, markers])

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-xs text-center px-4"
        style={{ height }}
      >
        {loading ? 'Loading odds…' : 'No trades yet.'}
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
        {dots.map((d, i) => (
          <ReferenceDot
            key={`m${i}`}
            x={d.t}
            y={d.v}
            r={3.5}
            fill={d.buy ? colors[d.index % colors.length] : '#0b1220'}
            stroke={colors[d.index % colors.length]}
            strokeWidth={1.5}
            isFront
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
