import moment from 'moment'
import { useMemo, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTicks } from '@/lib/juicebox/useTicks'
import { useTimelineRange } from '@/lib/juicebox/useTimelineRange'
import { LoadingSpinner } from './LoadingSpinner'
import RangeSelector from './RangeSelector'

export type LineChartData = {
  [key: string]: any
}

export type LineChartProps = {
  data: LineChartData[]
  dataCategories?: any[]
  isLoading: boolean
  height: number
  compact?: boolean
  createdAt?: number
  defaultRange?: number
  config: {
    timestampField: string
    valueField: string
    dataProcessing: 'cumulative' | 'direct'
    labels: {
      title: string
      valueLabel: string
      emptyMessage: string
    }
    styling?: {
      stroke?: string
      color?: string
      backgroundColor?: string
      fontSize?: string
      strokeWidth?: number
      compactStrokeWidth?: number
    }
    timeRange?: {
      compactDays?: number
      defaultRange?: number
    }
    fillMissingDays?: boolean
  }
}

const now = Date.now().valueOf()

const getYPaddingForValue = (maxValue: number, dataRange: number) => {
  if (dataRange === 0) {
    const paddingRates = [
      { threshold: 1000, rate: 0.05 },
      { threshold: 100000, rate: 0.03 },
      { threshold: 10000000, rate: 0.02 },
      { threshold: Infinity, rate: 0.01 },
    ]
    return paddingRates.find((p) => maxValue <= p.threshold)!.rate * maxValue
  }

  const baseRate = maxValue <= 100000 ? 0.3 : 0.2
  const minRate = maxValue <= 100000 ? 0.02 : 0.01
  return Math.max(dataRange * baseRate, maxValue * minRate)
}

const getYRoundingConfig = (range: number) => {
  const configs = [
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

const getYStandardMaxValue = (maxValue: number) => {
  const configs = [
    { threshold: 10, divisor: 1, multiplier: 1 },
    { threshold: 100, divisor: 10, multiplier: 10 },
    { threshold: 1000, divisor: 50, multiplier: 50 },
    { threshold: 10000, divisor: 100, multiplier: 100 },
    { threshold: 100000, divisor: 1000, multiplier: 1000 },
    { threshold: 1000000, divisor: 10000, multiplier: 10000 },
    { threshold: Infinity, divisor: 100000, multiplier: 100000 },
  ]

  const config = configs.find((c) => maxValue <= c.threshold)!
  return maxValue <= 10
    ? Math.ceil(maxValue)
    : Math.ceil(maxValue / config.divisor) * config.multiplier
}

const calculateYAxisScale = (values: number[], compact: boolean) => {
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)
  const dataRange = maxValue - minValue
  const tickCount = compact ? 3 : 5

  if (dataRange < maxValue * 0.15 || (dataRange === 0 && maxValue > 100)) {
    const padding = getYPaddingForValue(maxValue, dataRange)
    let yMin = Math.max(0, minValue - padding)
    let yMax = maxValue + padding

    const range = yMax - yMin
    const divisor = getYRoundingConfig(range)

    yMin = Math.floor(yMin / divisor) * divisor
    yMax = Math.ceil(yMax / divisor) * divisor

    const step = (yMax - yMin) / tickCount
    return {
      ticks: Array.from({ length: tickCount + 1 }, (_, i) =>
        Math.round(yMin + step * i)
      ),
      domain: [yMin, yMax],
    }
  }

  const yMax = getYStandardMaxValue(maxValue)
  const step = yMax / tickCount

  return {
    ticks: Array.from({ length: tickCount + 1 }, (_, i) =>
      Math.round(step * i)
    ),
    domain: [0, yMax],
  }
}

export default function LineChart({
  data,
  dataCategories,
  isLoading,
  height,
  compact = false,
  createdAt = 0,
  defaultRange,
  config,
}: LineChartProps) {
  const {
    timestampField,
    valueField,
    dataProcessing,
    labels,
    styling = {},
    timeRange = {},
    fillMissingDays = false,
  } = config

  const stroke = styling.stroke || 'white'
  const color = styling.color || 'white'
  const bg = styling.backgroundColor || 'black'
  const fontSize = styling.fontSize || '0.75rem'
  const strokeWidth = styling.strokeWidth || 4
  const compactStrokeWidth = styling.compactStrokeWidth || 1.5

  const hookResult = useTimelineRange({
    createdAt: createdAt,
  }) as [number, (value: number) => void]

  // Use local state for range when defaultRange is provided
  const [localRange, setLocalRange] = useState<number | null>(null)
  const [initializedDefault, setInitializedDefault] = useState(false)

  // Initialize with defaultRange if provided
  useEffect(() => {
    if (defaultRange !== undefined && !initializedDefault) {
      setLocalRange(defaultRange)
      setInitializedDefault(true)
    }
  }, [defaultRange, initializedDefault])

  // Use local range if available, otherwise use hook result
  const range = localRange !== null ? localRange : hookResult[0]
  const setRange = (value: number) => {
    if (localRange !== null) {
      setLocalRange(value)
    } else {
      hookResult[1](value)
    }
  }

  const xDomain = useMemo(() => {
    const nowInSeconds = Math.floor(now / 1000)
    const startOfToday =
      Math.floor(nowInSeconds / (24 * 60 * 60)) * (24 * 60 * 60)
    const endOfToday = startOfToday + 24 * 60 * 60
    const days = compact ? timeRange.compactDays || 365 : +range

    const startOfRange = startOfToday - (days - 1) * 24 * 60 * 60

    return [startOfRange, endOfToday] as [number, number]
  }, [range, compact, timeRange.compactDays])

  const defaultXTicks = useTicks({
    range: xDomain,
    resolution: compact ? 10 : 7,
    offset: 0,
  })

  const xTicks = useMemo(() => {
    if (fillMissingDays) {
      // When filling missing days, align ticks with day boundaries
      const startDay = Math.floor(xDomain[0] / (24 * 60 * 60)) * (24 * 60 * 60)
      const endDay = Math.floor(xDomain[1] / (24 * 60 * 60)) * (24 * 60 * 60)
      const totalDays = (endDay - startDay) / (24 * 60 * 60)

      // Calculate appropriate tick interval based on range
      let tickInterval = 1 // Default to daily ticks
      if (totalDays > 30) {
        tickInterval = Math.ceil(totalDays / 7) // Show ~7 ticks for longer ranges
      } else if (totalDays > 14) {
        tickInterval = Math.ceil(totalDays / 7) // Show ~7 ticks for 30-day range
      }

      const ticks = []
      for (
        let day = startDay;
        day <= endDay;
        day += tickInterval * 24 * 60 * 60
      ) {
        ticks.push(day)
      }
      return ticks
    } else {
      // Use the default tick calculation for non-filled data
      return defaultXTicks
    }
  }, [xDomain, fillMissingDays, defaultXTicks])

  // Process data based on configuration
  const processedPoints = useMemo(() => {
    if (!data?.length || isLoading) return []

    let points: any[] = []

    if (dataProcessing === 'cumulative') {
      // Sort data by timestamp
      const sortedData = [...data].sort(
        (a, b) =>
          parseInt(String(a[timestampField])) -
          parseInt(String(b[timestampField]))
      )

      // Count entries that happened before the range starts
      const entriesBeforeRange = sortedData.filter(
        (entry) => parseInt(String(entry[timestampField])) < xDomain[0]
      )
      let cumulativeCount = entriesBeforeRange.length

      // Add initial point at the start of the range with the count up to that point
      points.push({
        timestamp: xDomain[0],
        [valueField]: cumulativeCount,
      })

      // Add points for each entry within the range
      sortedData.forEach((entry) => {
        const timestamp = parseInt(String(entry[timestampField]))
        if (timestamp >= xDomain[0] && timestamp <= xDomain[1]) {
          cumulativeCount++
          points.push({
            timestamp,
            [valueField]: cumulativeCount,
          })
        }
      })

      // Add final point at the end of the range
      points.push({
        timestamp: xDomain[1],
        [valueField]: cumulativeCount,
      })
    } else {
      // Direct data processing - filter by time range and use values directly
      const pointsInRange = data
        .filter((entry) => {
          const timestamp = parseInt(String(entry[timestampField]))
          return timestamp >= xDomain[0] && timestamp <= xDomain[1]
        })
        .map((entry) => ({
          timestamp: parseInt(String(entry[timestampField])),
          [valueField]: entry[valueField],
        }))
        .sort((a, b) => a.timestamp - b.timestamp)

      // For fillMissingDays, also include the most recent point before the range
      // This ensures proper context for filling missing days
      if (fillMissingDays) {
        const pointsBeforeRange = data
          .filter((entry) => {
            const timestamp = parseInt(String(entry[timestampField]))
            return timestamp < xDomain[0]
          })
          .map((entry) => ({
            timestamp: parseInt(String(entry[timestampField])),
            [valueField]: entry[valueField],
          }))
          .sort((a, b) => a.timestamp - b.timestamp)

        const lastPointBeforeRange =
          pointsBeforeRange[pointsBeforeRange.length - 1]
        points = lastPointBeforeRange
          ? [lastPointBeforeRange, ...pointsInRange]
          : pointsInRange
      } else {
        points = pointsInRange
      }
    }

    if (fillMissingDays && points.length > 0) {
      const filledPoints: any[] = []
      const startDay = Math.floor(xDomain[0] / (24 * 60 * 60)) * (24 * 60 * 60)
      const endDay = Math.floor(xDomain[1] / (24 * 60 * 60)) * (24 * 60 * 60)

      const pointsByDay = new Map()
      points.forEach((point) => {
        const dayTimestamp =
          Math.floor(point.timestamp / (24 * 60 * 60)) * (24 * 60 * 60)
        pointsByDay.set(dayTimestamp, point[valueField])
      })

      // Find the last known value before the range starts
      let lastValue = points[0][valueField]

      // Look for any data points before the start of our range to get a better starting value
      const pointsBeforeRange = points.filter(
        (point) => point.timestamp < startDay
      )
      if (pointsBeforeRange.length > 0) {
        // Use the most recent value before our range
        lastValue = pointsBeforeRange[pointsBeforeRange.length - 1][valueField]
      }

      // Generate all days in the range
      for (let day = startDay; day <= endDay; day += 24 * 60 * 60) {
        if (pointsByDay.has(day)) {
          // Use actual data point value and update lastValue
          lastValue = pointsByDay.get(day)
          filledPoints.push({
            timestamp: day,
            [valueField]: lastValue,
          })
        } else {
          // Use the last known value for missing days
          const numericValue = Number(lastValue)
          filledPoints.push({
            timestamp: day,
            [valueField]: isNaN(numericValue) ? 0 : numericValue,
          })
        }
      }

      return filledPoints.sort((a, b) => a.timestamp - b.timestamp)
    }

    return points
  }, [
    data,
    xDomain,
    isLoading,
    dataProcessing,
    timestampField,
    valueField,
    fillMissingDays,
  ])

  const yAxisScale = useMemo(() => {
    if (!processedPoints?.length)
      return { ticks: [0, 1, 2, 3, 4, 5], domain: [0, 5] }

    const values = processedPoints.map((point) => Number(point[valueField]))
    return calculateYAxisScale(values, compact)
  }, [processedPoints, compact, valueField])

  const yTicks = yAxisScale.ticks

  const yDomain = yAxisScale.domain

  const allZeroValues = useMemo(() => {
    if (!processedPoints?.length) return true
    return processedPoints.every((point) => Number(point[valueField]) === 0)
  }, [processedPoints, valueField])

  const dateStringForBlockTime = useMemo(() => {
    const totalDays = (xDomain[1] - xDomain[0]) / (24 * 60 * 60)

    const formatConfigs = [
      { threshold: 30, format: 'M/D' },
      { threshold: 365, format: 'MMM D' },
      { threshold: Infinity, format: "MMM 'YY" },
    ]

    const config = formatConfigs.find((c) => totalDays <= c.threshold)!
    return (timestampSecs: number) =>
      moment.utc(timestampSecs * 1000).format(config.format)
  }, [xDomain])

  if (compact) {
    return (
      <ResponsiveContainer height={height} width="100%">
        <RechartsLineChart
          margin={{
            top: 4,
            right: 4,
            bottom: 4,
            left: 4,
          }}
          data={processedPoints}
        >
          {/* Add invisible axes for proper scaling */}
          <YAxis hide domain={[yDomain[0], yDomain[1]]} type="number" />
          <XAxis hide domain={xDomain} type="number" dataKey="timestamp" />
          <defs>
            <linearGradient
              id={`colorGradient-${valueField}-compact`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="5%" stopColor="#425eeb" />
              <stop offset="90%" stopColor="#6d3f79" />
            </linearGradient>
          </defs>
          {processedPoints?.length && (
            <Line
              dot={false}
              stroke={`url(#colorGradient-${valueField}-compact)`}
              strokeWidth={compactStrokeWidth}
              type="linear"
              dataKey={valueField}
              animationDuration={0}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div id={`${valueField}-timeline-chart`}>
      <div className="mt-8 w-full flex flex-col md:flex-row items-center justify-between gap-8">
        <div id="range-selector">
          <RangeSelector range={range} setRange={setRange} />
        </div>
        {dataCategories && (
          <div className="flex flex-col md:flex-row items-center gap-2">
            {dataCategories.map((category: any) => {
              return (
                <div
                  key={category.name}
                  className={`text-sm`}
                  style={{ color: '#425eeb' }}
                >
                  {`◉ ${category.name}`}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="mt-4 w-full relative">
        {!isLoading && data && allZeroValues && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
            <div
              className="text-white text-xl font-semibold font-GoodTimes"
              id="no-activity-message"
            >
              {labels.emptyMessage}
            </div>
          </div>
        )}
        {isLoading && (
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
          <RechartsLineChart
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
                const { value } = props.payload

                return (
                  <g>
                    <rect
                      transform={`translate(${props.x},${props.y - 6})`}
                      height={12}
                      width={String(value).length * 8}
                      fill={bg}
                    />
                    <text
                      fontSize={fontSize}
                      fill={color}
                      transform={`translate(${props.x + 4},${props.y + 4})`}
                    >
                      {value.toLocaleString()}
                    </text>
                  </g>
                )
              }}
              ticks={yTicks}
              domain={[yDomain[0], yDomain[1]]}
              type="number"
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
            <defs>
              <linearGradient
                id={`colorGradient-${valueField}-${
                  compact ? 'compact' : 'full'
                }`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
                gradientUnits="objectBoundingBox"
              >
                <stop offset="5%" stopColor="#425eeb" />
                <stop offset="90%" stopColor="#6d3f79" />
              </linearGradient>
              {fillMissingDays && (
                <linearGradient
                  id={`fillColorGradient-${valueField}-${
                    compact ? 'compact' : 'full'
                  }`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#425eeb" />
                  <stop offset="100%" stopColor="#6d3f79" />
                </linearGradient>
              )}
            </defs>
            {processedPoints?.length && (
              <Line
                dot={false}
                stroke={
                  fillMissingDays
                    ? `url(#fillColorGradient-${valueField}-${
                        compact ? 'compact' : 'full'
                      })`
                    : `url(#colorGradient-${valueField}-${
                        compact ? 'compact' : 'full'
                      })`
                }
                strokeWidth={strokeWidth}
                type="linear"
                dataKey={valueField}
                animationDuration={0}
                connectNulls={true}
                isAnimationActive={false}
              />
            )}
            <Tooltip
              cursor={{ stroke: color }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null

                const value = payload[0].payload[valueField]

                return (
                  <div className="bg-smoke-100 p-2 text-sm dark:bg-slate-600">
                    <div className="text-grey-400 dark:text-slate-200">
                      {dateStringForBlockTime(payload[0].payload.timestamp)}
                    </div>
                    <div className="font-medium">
                      {value.toLocaleString()} {labels.valueLabel}
                    </div>
                  </div>
                )
              }}
              animationDuration={50}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
