import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  availableOddsRanges,
  buildOddsTimeDomain,
  buildOddsValueDomain,
  formatOddsTick,
  formatOddsTooltip,
  resampleOddsHistory,
  sliceOddsTimeDomain,
  type OddsSample,
  type OddsTimeRange,
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
  /** Retained for caller compatibility; trade events are smoothed into the curve. */
  markers?: OddsMarker[]
  /** True while the on-chain history is still loading. */
  loading?: boolean
  /**
   * 'detail' — market page: interactive legend, live scrub values, timeframe pills.
   * 'hero' — compact index carousel preview: sleek lines without duplicate chrome.
   * 'default' — minimal standalone chart.
   */
  variant?: 'default' | 'hero' | 'detail'
}

/** Outcomes ranked within this tier render at full visual weight by default. */
const PROMINENT_OUTCOMES = 4

type ChartRow = Record<string, number>

function LiveEndDot(props: {
  cx?: number
  cy?: number
  index?: number
  lastIndex: number
  color: string
  prominent: boolean
  dimmed: boolean
}) {
  const { cx, cy, index, lastIndex, color, prominent, dimmed } = props
  if (index !== lastIndex || cx == null || cy == null) return null

  if (dimmed) {
    return <circle cx={cx} cy={cy} r={2.25} fill={color} fillOpacity={0.2} />
  }

  if (!prominent) {
    return <circle cx={cx} cy={cy} r={2.5} fill={color} fillOpacity={0.65} />
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={6.5} fill={color} fillOpacity={0.22} />
      <circle cx={cx} cy={cy} r={3.25} fill={color} stroke="#0a0f1c" strokeWidth={1.5} />
    </g>
  )
}

function OddsTooltip({
  active,
  payload,
  labels,
  colors,
  outcomeCount,
  spanMs,
  focusedOutcome,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
  labels: string[]
  colors: string[]
  outcomeCount: number
  spanMs: number
  focusedOutcome: number | null
}) {
  const row = payload?.[0]?.payload
  if (!active || !row || typeof row.t !== 'number') return null

  const items = Array.from({ length: outcomeCount }, (_, i) => ({
    index: i,
    name: labels[i] ?? `Outcome #${i + 1}`,
    color: colors[i % colors.length],
    value: row[`v${i}`],
  }))
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)

  if (!items.length) return null

  return (
    <div className="pointer-events-none min-w-[168px] rounded-xl border border-white/[0.12] bg-[#0b1220]/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
      <p className="mb-1.5 text-[11px] font-medium tabular-nums text-gray-400">
        {formatOddsTooltip(row.t, spanMs)}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const dimmed = focusedOutcome !== null && focusedOutcome !== item.index
          return (
            <div
              key={item.index}
              className={`flex items-center justify-between gap-4 text-xs ${
                dimmed ? 'opacity-40' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate max-w-[140px] text-gray-200">{item.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-white">
                {item.value.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartLoadingState({ height }: { height: number }) {
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white/[0.02] px-3 py-4"
      style={{ height }}
      aria-label="Loading odds"
    >
      <div className="h-px w-full bg-white/[0.05]" />
      <div className="h-px w-full bg-white/[0.05]" />
      <div className="h-px w-full bg-white/[0.05]" />
      <div className="h-px w-full bg-white/[0.05]" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-500 animate-pulse">
        Loading odds…
      </span>
    </div>
  )
}

export default function OddsHistoryChart({
  history,
  labels,
  colors,
  height = 220,
  domainStartMs,
  loading = false,
  variant = 'default',
}: Props) {
  const detail = variant === 'detail'
  const hero = variant === 'hero'
  const rightAxis = detail || hero
  const outcomeCount = labels.length

  const rawId = useId()
  const gradPrefix = useMemo(() => `odds-area-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId])

  const [range, setRange] = useState<OddsTimeRange>('ALL')
  const [hoveredOutcome, setHoveredOutcome] = useState<number | null>(null)
  const [pinnedOutcome, setPinnedOutcome] = useState<number | null>(null)
  const [scrubPoint, setScrubPoint] = useState<{ t: number; values: number[] } | null>(null)

  const fullDomain = useMemo(
    () => buildOddsTimeDomain(history, domainStartMs),
    [history, domainStartMs],
  )

  const ranges = useMemo(() => availableOddsRanges(fullDomain.spanMs), [fullDomain.spanMs])

  useEffect(() => {
    if (!ranges.includes(range)) setRange('ALL')
  }, [ranges, range])

  useEffect(() => {
    if (pinnedOutcome !== null && pinnedOutcome >= outcomeCount) setPinnedOutcome(null)
  }, [pinnedOutcome, outcomeCount])

  const activeRange: OddsTimeRange = detail && ranges.includes(range) ? range : 'ALL'

  const { data, samples, tMin, tMax, ticks, spanMs } = useMemo(() => {
    if (!history.length) {
      return {
        data: [] as ChartRow[],
        samples: [] as OddsSample[],
        tMin: 0,
        tMax: 0,
        ticks: [] as number[],
        spanMs: 0,
      }
    }

    const domain =
      activeRange === 'ALL'
        ? fullDomain
        : sliceOddsTimeDomain(history, activeRange, domainStartMs, fullDomain.tMax)
    const resampled = resampleOddsHistory(history, domain)

    const rows = resampled.map((s) => {
      const row: ChartRow = { t: s.t }
      for (let i = 0; i < outcomeCount; i++) row[`v${i}`] = s.p[i]
      return row
    })

    return { data: rows, samples: resampled, ...domain }
  }, [history, activeRange, fullDomain, domainStartMs, outcomeCount])

  const yDomain = useMemo(
    () => buildOddsValueDomain(samples, outcomeCount),
    [samples, outcomeCount],
  )

  // Latest values drive legend ordering and visual hierarchy (leader drawn on top).
  const latestValues = useMemo(() => {
    const last = data[data.length - 1]
    return Array.from({ length: outcomeCount }, (_, i) => last?.[`v${i}`] ?? NaN)
  }, [data, outcomeCount])

  const rankedIndices = useMemo(
    () =>
      Array.from({ length: outcomeCount }, (_, i) => i).sort(
        (a, b) => (latestValues[b] || 0) - (latestValues[a] || 0),
      ),
    [outcomeCount, latestValues],
  )

  const rankOf = useMemo(() => {
    const m = new Map<number, number>()
    rankedIndices.forEach((outcomeIdx, rank) => m.set(outcomeIdx, rank))
    return m
  }, [rankedIndices])

  const focusedOutcome = hoveredOutcome ?? pinnedOutcome
  const leaderIndex = rankedIndices[0]
  const areaIndex = focusedOutcome ?? leaderIndex

  // Draw order: lower-ranked lines first, leader near the top, focused line last (on top).
  const drawOrder = useMemo(() => {
    return [...rankedIndices].reverse().sort((a, b) => {
      if (a === focusedOutcome) return 1
      if (b === focusedOutcome) return -1
      return 0
    })
  }, [rankedIndices, focusedOutcome])

  // Compact hero charts have less width; keep ticks comfortably separated.
  const xTicks = useMemo(() => {
    if (spanMs <= 0) return ticks
    const minGapRatio = hero ? 5 : 6.5
    const kept: number[] = []
    for (const t of ticks) {
      if (!kept.length || t - kept[kept.length - 1] >= spanMs / minGapRatio) {
        kept.push(t)
      }
    }
    return kept
  }, [hero, ticks, spanMs])

  const handleMouseMove = useCallback(
    (state: any) => {
      if (!detail) return
      const row = state?.activePayload?.[0]?.payload as ChartRow | undefined
      if (!row || typeof row.t !== 'number') return
      setScrubPoint((prev) => {
        if (prev && prev.t === row.t) return prev
        const values = Array.from({ length: outcomeCount }, (_, i) => row[`v${i}`])
        return { t: row.t, values }
      })
    },
    [detail, outcomeCount],
  )

  const handleMouseLeave = useCallback(() => {
    if (!detail) return
    setScrubPoint(null)
  }, [detail])

  if (data.length < 2) {
    if (loading) return <ChartLoadingState height={height} />
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/[0.02] px-4 text-center text-xs text-gray-500"
        style={{ height }}
      >
        No trades yet.
      </div>
    )
  }

  const displayValues = scrubPoint ? scrubPoint.values : latestValues
  const lastIndex = data.length - 1
  const areaColor = areaIndex !== undefined ? colors[areaIndex % colors.length] : undefined

  return (
    <div className="flex flex-col">
      {detail && outcomeCount > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5"
          role="group"
          aria-label="Chart outcomes"
        >
          {rankedIndices.map((i) => {
            const color = colors[i % colors.length]
            const val = displayValues[i]
            const isPinned = pinnedOutcome === i
            const isFocused = focusedOutcome === i
            const isDimmed = focusedOutcome !== null && !isFocused
            const formattedVal = Number.isFinite(val)
              ? scrubPoint
                ? `${val.toFixed(1)}%`
                : `${Math.round(val)}%`
              : '—'
            return (
              <button
                key={i}
                type="button"
                aria-pressed={isPinned}
                onMouseEnter={() => setHoveredOutcome(i)}
                onMouseLeave={() => setHoveredOutcome((prev) => (prev === i ? null : prev))}
                onClick={() => setPinnedOutcome((prev) => (prev === i ? null : i))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  isPinned
                    ? 'border-white/20 bg-white/[0.09] text-white'
                    : 'border-transparent bg-white/[0.03] text-gray-300 hover:bg-white/[0.07] hover:text-white'
                } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="max-w-[140px] truncate font-medium">
                  {labels[i] ?? `Outcome #${i + 1}`}
                </span>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: isFocused || isPinned ? '#ffffff' : color }}
                >
                  {formattedVal}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={
            rightAxis
              ? { top: 10, right: 2, bottom: 2, left: 4 }
              : { top: 8, right: 14, bottom: 4, left: 0 }
          }
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {areaIndex !== undefined && areaColor && (
              <linearGradient id={`${gradPrefix}-${areaIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={areaColor}
                  stopOpacity={focusedOutcome !== null ? 0.22 : 0.13}
                />
                <stop offset="85%" stopColor={areaColor} stopOpacity={0.02} />
                <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>

          <CartesianGrid
            stroke="rgba(255, 255, 255, 0.06)"
            strokeDasharray="3 4"
            vertical={false}
          />

          <XAxis
            dataKey="t"
            type="number"
            scale="linear"
            domain={[tMin, tMax]}
            ticks={xTicks}
            tickFormatter={(t) => formatOddsTick(Number(t), spanMs)}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={32}
            padding={{ left: 6, right: 10 }}
          />

          <YAxis
            domain={[yDomain.min, yDomain.max]}
            ticks={yDomain.ticks}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            orientation={rightAxis ? 'right' : 'left'}
            axisLine={false}
            tickLine={false}
            width={rightAxis ? 38 : 42}
          />

          <Tooltip
            isAnimationActive={false}
            cursor={{
              stroke: 'rgba(255, 255, 255, 0.18)',
              strokeWidth: 1,
              strokeDasharray: '3 3',
            }}
            content={
              <OddsTooltip
                labels={labels}
                colors={colors}
                outcomeCount={outcomeCount}
                spanMs={spanMs}
                focusedOutcome={focusedOutcome}
              />
            }
          />

          {areaIndex !== undefined && areaColor && (
            <Area
              type="monotone"
              dataKey={`v${areaIndex}`}
              stroke="none"
              fill={`url(#${gradPrefix}-${areaIndex})`}
              fillOpacity={1}
              baseValue={yDomain.min}
              isAnimationActive={false}
              dot={false}
              activeDot={false}
              tooltipType="none"
              connectNulls
            />
          )}

          {drawOrder.map((i) => {
            const color = colors[i % colors.length]
            const rank = rankOf.get(i) ?? outcomeCount
            const isFocused = focusedOutcome === i
            const isDimmed = focusedOutcome !== null && !isFocused
            const isProminent = isFocused || (focusedOutcome === null && rank < PROMINENT_OUTCOMES)
            const strokeWidth = isFocused
              ? 2.5
              : isDimmed
                ? 1.5
                : rank === 0
                  ? 2.25
                  : isProminent
                    ? 2
                    : 1.5
            const strokeOpacity = isFocused
              ? 1
              : isDimmed
                ? 0.16
                : isProminent
                  ? 0.95
                  : 0.45

            return (
              <Line
                key={i}
                type="monotone"
                dataKey={`v${i}`}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                connectNulls
                dot={(dotProps: any) => (
                  <LiveEndDot
                    key={dotProps.index}
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    index={dotProps.index}
                    lastIndex={lastIndex}
                    color={color}
                    prominent={isProminent}
                    dimmed={isDimmed}
                  />
                )}
                activeDot={
                  isDimmed
                    ? false
                    : {
                        r: isFocused ? 4.5 : 3.5,
                        fill: color,
                        stroke: '#0b1220',
                        strokeWidth: 2,
                      }
                }
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {detail && (ranges.length > 1 || scrubPoint || pinnedOutcome !== null) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-gray-500">
            {scrubPoint ? (
              <span className="tabular-nums text-gray-300">
                {formatOddsTooltip(scrubPoint.t, spanMs)}
              </span>
            ) : pinnedOutcome !== null ? (
              <button
                type="button"
                onClick={() => setPinnedOutcome(null)}
                className="text-gray-400 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
              >
                Show all outcomes
              </button>
            ) : (
              <span className="text-gray-600">Hover chart to inspect · click an outcome to isolate</span>
            )}
          </div>

          {ranges.length > 1 && (
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5"
              role="group"
              aria-label="Chart timeframe"
            >
              {ranges.map((r) => {
                const selected = activeRange === r
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                      selected
                        ? 'bg-white/[0.12] text-white'
                        : 'text-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
