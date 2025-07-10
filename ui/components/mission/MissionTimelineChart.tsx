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
import { useTicks } from '@/lib/juicebox/useTicks'
import { useTimelineRange } from '@/lib/juicebox/useTimelineRange'
import { useTimelineYDomain } from '@/lib/juicebox/useTimelineYDomain'
import { truncateTokenValue, wadToFloat } from '@/lib/utils/numbers'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import RangeSelector from '../layout/RangeSelector'

export type MissionTimelineChartProps = {
  points: any[]
  isLoadingPoints: boolean
  height: number
  createdAt: number
}

const now = Date.now().valueOf() // Using real current time

export default function MissionTimelineChart({
  points,
  isLoadingPoints,
  height,
  createdAt,
}: MissionTimelineChartProps) {
  const stroke = 'white'
  const color = 'white'
  const bg = 'black'
  const fontSize = '0.75rem'

  const [view, setView] = useState<'volume' | 'balance' | 'trendingScore'>(
    'volume'
  )
  const [range, setRange] = useTimelineRange({
    createdAt,
  })

  const xDomain = useMemo(() => {
    const endOfDay = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60) // Round to midnight
    const startOfDay = endOfDay - +range * 24 * 60 * 60

    // Find the min and max timestamps from points with volume
    let minTime = startOfDay
    let maxTime = endOfDay

    if (points?.length) {
      const pointsWithVolume = points.filter((p) => p.volume > 0)
      if (pointsWithVolume.length) {
        const timestamps = pointsWithVolume.map((p) => p.timestamp)
        minTime = Math.min(minTime, ...timestamps)
        maxTime = Math.max(maxTime, ...timestamps)
      }
    }

    return [minTime, maxTime] as [number, number]
  }, [range, points])

  const xTicks = useTicks({
    range: xDomain,
    resolution: 7,
    offset: 0.5,
  })

  // Process points to ensure all x-ticks have data points with y values defaulting to 0
  const processedPoints = useMemo(() => {
    if (!points?.length || isLoadingPoints) return []

    // Process the original points to ensure all values exist
    const processedOriginalPoints = points.map((point) => ({
      ...point,
      volume: point.volume ?? 0,
      balance: point.balance ?? 0,
      trendingScore: point.trendingScore ?? 0,
    }))

    // Group points by date (using moment to get date string without time)
    const pointsByDate = new Map()

    // First group the actual data points by date
    processedOriginalPoints.forEach((point) => {
      const dateKey = moment(point.timestamp * 1000).format('YYYY-MM-DD')

      // If we already have a point for this date, keep the one with higher values
      if (pointsByDate.has(dateKey)) {
        const existingPoint = pointsByDate.get(dateKey)
        pointsByDate.set(dateKey, {
          ...point,
          // For each metric, use the higher value between existing and new point
          volume: Math.max(existingPoint.volume, point.volume),
          balance: Math.max(existingPoint.balance, point.balance),
          trendingScore: Math.max(
            existingPoint.trendingScore,
            point.trendingScore
          ),
        })
      } else {
        pointsByDate.set(dateKey, point)
      }
    })

    // Make sure all tick dates have entries (but don't overwrite existing data)
    xTicks.forEach((tick) => {
      const dateKey = moment(tick * 1000).format('YYYY-MM-DD')
      if (!pointsByDate.has(dateKey)) {
        pointsByDate.set(dateKey, {
          timestamp: tick,
          volume: 0,
          balance: 0,
          trendingScore: 0,
        })
      }
    })

    // Convert back to array and sort by timestamp
    return Array.from(pointsByDate.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    )
  }, [points, xTicks, view])

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
        <div id="range-selector">
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
              top: 10, // hacky way to hide top border of CartesianGrid
              right: 0,
              bottom: 10,
              left: 1, // ensure y axis isn't cut off
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
                  transform={`translate(${props.x - 14},${props.y + 14})`}
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
              allowDataOverflow={false}
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
              <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="5%" stopColor="#425eeb" />
                <stop offset="90%" stopColor="#6d3f79" />
              </linearGradient>
            </defs>
            {processedPoints?.length && (
              <Line
                dot={false}
                stroke="url(#colorGradient)"
                strokeWidth={4}
                type="monotone"
                dataKey={view}
                activeDot={{ r: 6, fill: '#6d3f79', stroke: undefined }}
                animationDuration={750}
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
