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
import { useTimelineYDomain } from '@/lib/juicebox/useTimelineYDomain'
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

  const defaultYDomain = useTimelineYDomain(
    processedPoints?.map((point) => point[view])
  )

  const { trendingProjects } = useJBTrendingProjects()
  const highTrendingScore = trendingProjects?.length
    ? wadToFloat(trendingProjects[0].trendingScore)
    : undefined
  const highTrendingPoint =
    points?.reduce(
      (acc, curr) => (curr.trendingScore > acc ? curr.trendingScore : acc),
      0
    ) ?? 0

  const originalYDomain: [number, number] =
    view === 'trendingScore' && highTrendingScore
      ? [
          defaultYDomain[0],
          Math.max(highTrendingScore, highTrendingPoint) * 1.05,
        ]
      : defaultYDomain

  const yTicks = useMemo(() => {
    // Get the max value in the current view
    const maxValue = Math.max(
      ...processedPoints.map((point) => point[view]),
      0.00001
    )

    // Create ticks based on the order of magnitude
    let tickCount = 5
    let ticks = []

    if (maxValue < 0.0001) {
      // Very small values
      const step = maxValue / tickCount
      for (let i = 0; i <= tickCount; i++) {
        ticks.push(step * i)
      }
    } else if (maxValue < 0.001) {
      // Small values
      for (let i = 0; i <= tickCount; i++) {
        ticks.push((maxValue / tickCount) * i)
      }
    } else if (maxValue < 0.01) {
      // Values in 0.001-0.01 range
      for (let i = 0; i <= tickCount; i++) {
        ticks.push(0.002 * i)
      }
    } else if (maxValue < 0.1) {
      // Values in 0.01-0.1 range
      for (let i = 0; i <= 5; i++) {
        ticks.push(0.02 * i)
      }
    } else if (maxValue < 1) {
      // Values in 0.1-1 range
      for (let i = 0; i <= 5; i++) {
        ticks.push(0.2 * i)
      }
    } else if (maxValue < 10) {
      // Values in 1-10 range
      for (let i = 0; i <= 5; i++) {
        ticks.push(2 * i)
      }
    } else {
      // Values above 10
      const roundedMax = Math.ceil(maxValue / 10) * 10
      const step = roundedMax / 5
      for (let i = 0; i <= 5; i++) {
        ticks.push(step * i)
      }
    }

    return ticks
  }, [processedPoints, view])

  const yDomain = useMemo(() => {
    // For trending score, use the original domain
    if (view === 'trendingScore' && highTrendingScore) {
      return originalYDomain
    }

    // Otherwise use the domain based on our custom ticks
    if (yTicks.length) {
      return [0, yTicks[yTicks.length - 1]]
    }

    return [0, 0.1]
  }, [yTicks, view, originalYDomain, highTrendingScore])

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

                let formattedValue
                // Use a consistent format based on the magnitude of the value
                if (value === 0) {
                  formattedValue = '0'
                } else if (value < 0.0001) {
                  formattedValue = value.toExponential(2)
                } else if (value < 0.001) {
                  formattedValue = value.toFixed(6)
                } else if (value < 0.01) {
                  formattedValue = value.toFixed(4)
                } else if (value < 0.1) {
                  formattedValue = value.toFixed(3)
                } else if (value < 1) {
                  formattedValue = value.toFixed(2)
                } else if (value < 10) {
                  formattedValue = value.toFixed(1)
                } else {
                  formattedValue = value.toFixed(0)
                }

                return (
                  <g>
                    <rect
                      transform={`translate(${props.x},${props.y - 6})`}
                      height={12}
                      width={formattedValue.length * 8}
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
              interval={0}
              mirror
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
