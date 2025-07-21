import moment from 'moment'
import { useMemo } from 'react'
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
  isLoading: boolean
  height: number
  compact?: boolean
  createdAt?: number
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
  }
}

const now = Date.now().valueOf()

export default function LineChart({
  data,
  isLoading,
  height,
  compact = false,
  createdAt = 0,
  config,
}: LineChartProps) {
  const {
    timestampField,
    valueField,
    dataProcessing,
    labels,
    styling = {},
    timeRange = {},
  } = config

  const stroke = styling.stroke || 'white'
  const color = styling.color || 'white'
  const bg = styling.backgroundColor || 'black'
  const fontSize = styling.fontSize || '0.75rem'
  const strokeWidth = styling.strokeWidth || 4
  const compactStrokeWidth = styling.compactStrokeWidth || 1.5

  const [range, setRange] = useTimelineRange({
    createdAt: createdAt,
  })

  const xDomain = useMemo(() => {
    const endOfDay = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60)
    const days = compact ? timeRange.compactDays || 365 : +range
    const startOfDay = endOfDay - days * 24 * 60 * 60

    return [startOfDay, endOfDay] as [number, number]
  }, [range, compact, timeRange.compactDays])

  const xTicks = useTicks({
    range: xDomain,
    resolution: compact ? 10 : 7,
    offset: 0.5,
  })

  // Process data based on configuration
  const processedPoints = useMemo(() => {
    if (!data?.length || isLoading) return []

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

      // Create points array with cumulative count
      const points: any[] = []

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

      return points
    } else {
      // Direct data processing - filter by time range and use values directly
      return data
        .filter((entry) => {
          const timestamp = parseInt(String(entry[timestampField]))
          return timestamp >= xDomain[0] && timestamp <= xDomain[1]
        })
        .map((entry) => ({
          timestamp: parseInt(String(entry[timestampField])),
          [valueField]: entry[valueField],
        }))
        .sort((a, b) => a.timestamp - b.timestamp)
    }
  }, [data, xDomain, isLoading, dataProcessing, timestampField, valueField])

  const yTicks = useMemo(() => {
    if (!processedPoints?.length) return [0, 1, 2, 3, 4, 5]

    const maxValue = Math.max(
      ...processedPoints.map((point) => Number(point[valueField]))
    )

    // Handle different scales more intelligently
    let roundedMax: number
    let tickCount = compact ? 3 : 5

    if (maxValue <= 10) {
      roundedMax = Math.ceil(maxValue)
      tickCount = compact ? Math.min(3, roundedMax) : roundedMax
    } else if (maxValue <= 100) {
      roundedMax = Math.ceil(maxValue / 10) * 10
    } else if (maxValue <= 1000) {
      roundedMax = Math.ceil(maxValue / 50) * 50
    } else {
      roundedMax = Math.ceil(maxValue / 100) * 100
    }

    const step = roundedMax / tickCount

    return Array.from({ length: tickCount + 1 }, (_, i) => Math.round(step * i))
  }, [processedPoints, compact, valueField])

  const yDomain = useMemo(() => {
    if (!processedPoints?.length) return [0, 5]

    const maxValue = Math.max(
      ...processedPoints.map((point) => Number(point[valueField]))
    )

    // Ensure we have some padding at the top
    const maxTick = yTicks[yTicks.length - 1]
    return [0, Math.max(maxTick, maxValue * 1.1)]
  }, [yTicks, processedPoints, valueField])

  const allZeroValues = useMemo(() => {
    if (!processedPoints?.length) return true
    return processedPoints.every((point) => Number(point[valueField]) === 0)
  }, [processedPoints, valueField])

  const dateStringForBlockTime = (timestampSecs: number) =>
    moment(timestampSecs * 1000).format('M/DD')

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
          <YAxis hide domain={yDomain} type="number" />
          <XAxis hide domain={xDomain} type="number" dataKey="timestamp" />
          <defs>
            <linearGradient
              id={`compactColorGradient-${valueField}`}
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
              stroke={`url(#compactColorGradient-${valueField})`}
              strokeWidth={compactStrokeWidth}
              type="monotone"
              dataKey={valueField}
              animationDuration={750}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div id={`${valueField}-timeline-chart`}>
      <div className="mt-8 w-full flex items-center justify-between gap-8">
        <div id="range-selector">
          <RangeSelector range={range} setRange={setRange} />
        </div>
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
              right: 0,
              bottom: 10,
              left: 1,
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
                      {value}
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
            <defs>
              <linearGradient
                id={`colorGradient-${valueField}`}
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
                stroke={`url(#colorGradient-${valueField})`}
                strokeWidth={strokeWidth}
                type="monotone"
                dataKey={valueField}
                activeDot={{ r: 6, fill: '#6d3f79', stroke: undefined }}
                animationDuration={750}
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
                      {value} {labels.valueLabel}
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
