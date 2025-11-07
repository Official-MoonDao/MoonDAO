import { CalendarDateRangeIcon } from '@heroicons/react/24/outline'
import moment from 'moment'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useJBTrendingProjects from '@/lib/juicebox/useJBTrendingProjects'
import { truncateTokenValue, wadToFloat } from '@/lib/utils/numbers'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import RangeSelector from '../layout/RangeSelector'

export type MissionTimelineChartProps = {
  points: any[]
  isLoadingPoints: boolean
  height: number
  createdAt: number
  range: number
  setRange: (range: number) => void
}

export default function MissionTimelineChart({
  points,
  isLoadingPoints,
  height,
  createdAt,
  range,
  setRange,
}: MissionTimelineChartProps) {
  const stroke = 'white'
  const color = 'white'
  const bg = 'black'
  const fontSize = '0.75rem'

  const [view, setView] = useState<'volume' | 'balance' | 'trendingScore'>(
    'volume'
  )

  // Use official Juicebox x-domain calculation pattern
  const xDomain = useMemo(() => {
    const now = Date.now().valueOf()
    const daysToMS = (days: number) => days * 24 * 60 * 60 * 1000
    return [
      Math.floor((now - daysToMS(range)) / 1000),
      Math.floor(now / 1000),
    ] as [number, number]
  }, [range])

  // Process points to ensure all values exist - keep it simple like official Juicebox
  const processedPoints = useMemo(() => {
    if (!points?.length || isLoadingPoints) return []

    const processed = points
      .map((point) => ({
        ...point,
        volume: point.volume ?? 0,
        balance: point.balance ?? 0,
        trendingScore: point.trendingScore ?? 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    // Chart data is now properly synchronized with timeline hook

    return processed
  }, [points, isLoadingPoints])

  // Generate exactly 7 x-axis ticks from actual data points
  const xTicks = useMemo(() => {
    if (!processedPoints?.length) {
      // Fallback when no data
      const [min, max] = xDomain
      const ticks = []
      for (let i = 0; i < 7; i++) {
        const timestamp = Math.round(min + (max - min) * (i / 6))
        ticks.push(timestamp)
      }
      return ticks
    }

    // Sample exactly 7 ticks from the actual data points
    const dataTimestamps = processedPoints.map((p) => p.timestamp)

    if (dataTimestamps.length <= 7) {
      // If we have 7 or fewer data points, use them all
      return dataTimestamps
    }

    // Sample 7 evenly distributed timestamps from the data
    const sampledTicks = []
    for (let i = 0; i < 7; i++) {
      const index = Math.round((dataTimestamps.length - 1) * (i / 6))
      sampledTicks.push(dataTimestamps[index])
    }

    return sampledTicks
  }, [processedPoints, xDomain])

  const { trendingProjects } = useJBTrendingProjects()
  const highTrendingScore = trendingProjects?.length
    ? wadToFloat(trendingProjects[0].trendingScore)
    : undefined
  const highTrendingPoint =
    points?.reduce(
      (acc, curr) => (curr.trendingScore > acc ? curr.trendingScore : acc),
      0
    ) ?? 0

  const yAxisScale = useMemo(() => {
    if (!processedPoints?.length)
      return { ticks: [0, 0.02, 0.04, 0.06, 0.08, 0.1], domain: [0, 0.1] }

    if (view === 'trendingScore' && highTrendingScore) {
      const yMax = Math.max(highTrendingScore, highTrendingPoint) * 1.05
      const tickCount = 5
      const step = yMax / tickCount
      return {
        ticks: Array.from({ length: tickCount + 1 }, (_, i) => step * i),
        domain: [0, yMax],
      }
    }

    const values = processedPoints.map((point) => point[view])
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const dataRange = maxValue - minValue
    const tickCount = 5

    const getYPaddingForValue = (maxValue: number, dataRange: number) => {
      if (dataRange === 0) {
        const paddingRates = [
          { threshold: 10, rate: 0.1 },
          { threshold: 1000, rate: 0.05 },
          { threshold: 100000, rate: 0.03 },
          { threshold: 10000000, rate: 0.02 },
          { threshold: Infinity, rate: 0.01 },
        ]
        return (
          paddingRates.find((p) => maxValue <= p.threshold)!.rate * maxValue
        )
      }

      if (maxValue <= 10) {
        return Math.max(dataRange * 0.15, maxValue * 0.05)
      }

      const baseRate = maxValue <= 100000 ? 0.3 : 0.2
      const minRate = maxValue <= 100000 ? 0.02 : 0.01
      return Math.max(dataRange * baseRate, maxValue * minRate)
    }

    const getYRoundingConfig = (range: number) => {
      const configs = [
        { threshold: 0.01, divisor: 0.001 },
        { threshold: 0.1, divisor: 0.01 },
        { threshold: 0.5, divisor: 0.05 },
        { threshold: 1, divisor: 0.1 },
        { threshold: 2, divisor: 0.2 },
        { threshold: 5, divisor: 0.5 },
        { threshold: 10, divisor: 1 },
        { threshold: 100, divisor: 5 },
        { threshold: 1000, divisor: 25 },
        { threshold: 10000, divisor: 100 },
        { threshold: 100000, divisor: 1000 },
        { threshold: 1000000, divisor: 10000 },
        { threshold: Infinity, divisor: 100000 },
      ]
      return configs.find((c) => range <= c.threshold)!.divisor
    }

    // Helper function for standard max - adjusted for small ETH values
    const getYStandardMaxValue = (maxValue: number) => {
      if (maxValue <= 0.01) return Math.ceil(maxValue * 1000) / 1000
      if (maxValue <= 0.1) return Math.ceil(maxValue * 100) / 100
      if (maxValue <= 1) return Math.ceil(maxValue * 10) / 10
      if (maxValue <= 10) return Math.ceil(maxValue)

      const configs = [
        { threshold: 100, divisor: 10, multiplier: 10 },
        { threshold: 1000, divisor: 50, multiplier: 50 },
        { threshold: 10000, divisor: 100, multiplier: 100 },
        { threshold: 100000, divisor: 1000, multiplier: 1000 },
        { threshold: 1000000, divisor: 10000, multiplier: 10000 },
        { threshold: Infinity, divisor: 100000, multiplier: 100000 },
      ]

      const config = configs.find((c) => maxValue <= c.threshold)!
      return Math.ceil(maxValue / config.divisor) * config.multiplier
    }

    if (maxValue < 10) {
      const padding = getYPaddingForValue(maxValue, dataRange)
      let yMin = Math.max(0, minValue - padding)
      let yMax = maxValue + padding

      const range = yMax - yMin
      const divisor = getYRoundingConfig(range)

      yMin = Math.floor(yMin / divisor) * divisor
      yMax = Math.ceil(yMax / divisor) * divisor

      const step = (yMax - yMin) / tickCount
      return {
        ticks: Array.from({ length: tickCount + 1 }, (_, i) => yMin + step * i),
        domain: [yMin, yMax],
      }
    }

    const yMax = getYStandardMaxValue(maxValue)
    const step = yMax / tickCount

    return {
      ticks: Array.from({ length: tickCount + 1 }, (_, i) => step * i),
      domain: [0, yMax],
    }
  }, [processedPoints, view, highTrendingScore, highTrendingPoint])

  const yTicks = yAxisScale.ticks
  const yDomain = yAxisScale.domain

  const allZeroValues = useMemo(() => {
    if (!processedPoints?.length) return true
    return processedPoints.every((point) => point[view] === 0)
  }, [processedPoints, view])

  const dateStringForBlockTime = (timestampSecs: number) =>
    moment(timestampSecs * 1000).format('M/DD')

  return (
    <div id="mission-timeline-chart">
      <div className="mt-8 w-full flex items-center justify-between gap-8">
        <div id="range-selector" className="w-full pl-5 z-[1000]">
          <RangeSelector range={range} setRange={setRange} />
        </div>
        <div className="flex items-center gap-2">
          <CalendarDateRangeIcon className="w-5 h-5" />
          <span className="text-sm" id="creation-date">
            {`Created ${new Date(createdAt * 1000).toLocaleDateString()}`}
          </span>
        </div>
      </div>
      <div className="mt-4 w-full relative">
        {!isLoadingPoints && points && allZeroValues && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
            <div
              className="text-white text-xl font-semibold font-GoodTimes"
              id="no-activity-message"
            >
              No Activity Yet
            </div>
          </div>
        )}
        {isLoadingPoints && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
            <div
              className="text-white text-xl font-semibold font-GoodTimes"
              id="no-activity-message"
            >
              <LoadingSpinner />
            </div>
          </div>
        )}
        <ResponsiveContainer height={height} id="chart-container">
          <LineChart
            margin={{
              top: 10,
              right: 24,
              bottom: 10,
              left: 24,
            }}
            data={processedPoints}
          >
            <CartesianGrid
              stroke={stroke}
              strokeDasharray="1 2"
              vertical={false}
            />
            <YAxis
              stroke={stroke}
              tickLine={false}
              tickSize={0}
              tick={(props) => {
                if (view === 'trendingScore' || !processedPoints?.length)
                  return <g></g>

                const { value } = props.payload

                const formattedValue =
                  value < 1 ? value.toFixed(4) : value.toLocaleString()

                return (
                  <g>
                    <rect
                      transform={`translate(${props.x},${props.y - 6})`}
                      height={12}
                      width={String(formattedValue).length * 8}
                      fill={bg}
                    />
                    <text
                      fontSize={fontSize}
                      fill={color}
                      transform={`translate(${props.x + 4},${props.y + 4})`}
                    >
                      {formattedValue}
                    </text>
                  </g>
                )
              }}
              ticks={yTicks}
              domain={yDomain}
              type="number"
              interval={0}
              mirror
              allowDataOverflow={false}
            />
            <XAxis
              stroke={stroke}
              tick={(props) => (
                <text
                  fontSize={fontSize}
                  fill={color}
                  transform={`translate(${props.x - 12},${props.y + 14})`}
                >
                  {dateStringForBlockTime(props.payload.value)}
                </text>
              )}
              ticks={xTicks}
              domain={xDomain}
              interval={0}
              tickLine={false}
              tickSize={0}
              type="number"
              dataKey="timestamp"
              scale="time"
            />
            {view === 'trendingScore' &&
              highTrendingScore &&
              processedPoints?.length && (
                <ReferenceLine
                  label={
                    <Label
                      fill={color}
                      style={{
                        fontSize,
                        fontWeight: 500,
                      }}
                      position="insideTopLeft"
                      offset={8}
                      value={`Current #1 trending`}
                    />
                  }
                  stroke={color}
                  y={highTrendingScore}
                />
              )}
            <defs>
              <linearGradient
                id={`colorGradient`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#425eeb" />
                <stop offset="100%" stopColor="#6d3f79" />
              </linearGradient>
            </defs>

            {processedPoints?.length && (
              <Line
                dot={false}
                stroke={'url(#colorGradient)'}
                strokeWidth={4}
                type="monotone"
                dataKey={view}
                activeDot={{ r: 6, fill: '#6d3f79', stroke: undefined }}
                animationDuration={750}
                connectNulls={false}
              />
            )}
            <Tooltip
              cursor={{ stroke: color }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null

                const amount = payload[0].payload[view]

                return (
                  <div className="bg-smoke-100 p-2 text-sm dark:bg-slate-600">
                    <div className="text-grey-400 dark:text-slate-200">
                      {dateStringForBlockTime(payload[0].payload.timestamp)}
                    </div>
                    {view !== 'trendingScore' && (
                      <div className="font-medium">
                        {truncateTokenValue(amount, 'ETH')}
                        {' ETH'}
                      </div>
                    )}
                  </div>
                )
              }}
              animationDuration={50}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
