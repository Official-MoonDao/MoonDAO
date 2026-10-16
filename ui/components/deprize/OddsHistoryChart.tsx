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
  /** 'hero' — the index carousel: right axis, step lines, labeled end dots. */
  variant?: 'default' | 'hero'
}

/** Hero end labels past this many outcomes stack on top of each other. */
const HERO_END_LABELS = 2
/** Two-line labels closer than this (percentage points) draw on top of each other. */
const HERO_LABEL_GAP_PT = 12

function HeroEndLabel(props: {
  x?: number
  y?: number
  index?: number
  value?: number
  lastIndex: number
  color: string
  name: string
}) {
  const { x, y, index, value, lastIndex, color, name } = props
  if (index !== lastIndex || x == null || y == null || value == null) return null
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill={color} opacity={0.25} />
      <circle cx={x} cy={y} r={3.5} fill={color} />
      <text x={x - 10} y={y - 8} textAnchor="end" fill={color} fontSize={11}>
        {name.length > 18 ? `${name.slice(0, 17)}…` : name}
      </text>
      <text x={x - 10} y={y + 10} textAnchor="end" fill={color} fontSize={16} fontWeight={700}>
        {Math.round(value)}%
      </text>
    </g>
  )
}

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
  domainStartMs,
  markers = [],
  loading = false,
  variant = 'default',
}: Props) {
  const hero = variant === 'hero'
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

  const labeledOutcomes = useMemo(() => {
    if (!hero || !data.length) return new Set<number>()
    const last = data[data.length - 1]
    const value = (i: number) => last[`v${i}`] ?? 0
    const ranked = Array.from({ length: outcomeCount }, (_, i) => i).sort(
      (a, b) => value(b) - value(a)
    )
    const picked: number[] = []
    for (const i of ranked) {
      if (picked.length >= HERO_END_LABELS) break
      if (picked.every((p) => Math.abs(value(p) - value(i)) >= HERO_LABEL_GAP_PT)) picked.push(i)
    }
    return new Set(picked)
  }, [hero, data, outcomeCount])

  // The hero chart is narrow; keep ticks at least a sixth of the span apart.
  const xTicks = useMemo(() => {
    if (!hero || spanMs <= 0) return ticks
    const kept: number[] = []
    for (const t of ticks) {
      if (!kept.length || t - kept[kept.length - 1] >= spanMs / 6) kept.push(t)
      else if (t === ticks[ticks.length - 1]) kept[kept.length - 1] = t
    }
    return kept
  }, [hero, ticks, spanMs])

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
      <LineChart
        data={data}
        margin={
          hero
            ? { top: 12, right: 0, bottom: 0, left: 0 }
            : { top: 8, right: 16, bottom: 8, left: 0 }
        }
      >
        <CartesianGrid
          stroke={hero ? '#ffffff14' : '#ffffff12'}
          strokeDasharray={hero ? '2 4' : undefined}
          vertical={false}
        />
        <XAxis
          dataKey="t"
          type="number"
          scale="linear"
          domain={[tMin, tMax]}
          ticks={xTicks}
          tickFormatter={(t) => formatOddsTick(Number(t), spanMs)}
          tick={{ fill: '#9ca3af', fontSize: 11, textAnchor: 'middle' }}
          stroke="#ffffff22"
          axisLine={!hero}
          tickLine={!hero}
          interval={0}
          minTickGap={0}
          padding={hero ? { left: 20, right: 12 } : { left: 8, right: 8 }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#ffffff22"
          orientation={hero ? 'right' : 'left'}
          axisLine={!hero}
          tickLine={!hero}
          width={hero ? 40 : 48}
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
        {Array.from({ length: outcomeCount }, (_, i) => i)
          .sort((a, b) => Number(labeledOutcomes.has(a)) - Number(labeledOutcomes.has(b)))
          .map((i) => (
            <Line
              key={i}
              type={hero ? 'stepAfter' : 'monotone'}
              dataKey={`v${i}`}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
              label={
                labeledOutcomes.has(i)
                  ? (p: any) => (
                      <HeroEndLabel
                        {...p}
                        lastIndex={data.length - 1}
                        color={colors[i % colors.length]}
                        name={labels[i] ?? ''}
                      />
                    )
                  : undefined
              }
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
