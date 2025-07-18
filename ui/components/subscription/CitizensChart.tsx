import { CalendarDateRangeIcon } from '@heroicons/react/24/outline'
import moment from 'moment'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTicks } from '@/lib/juicebox/useTicks'
import { useTimelineRange } from '@/lib/juicebox/useTimelineRange'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import RangeSelector from '../layout/RangeSelector'

export type CitizensChartProps = {
  transfers: {
    id: string
    from: string
    blockTimestamp: string
  }[]
  isLoading: boolean
  height: number
}

const now = Date.now().valueOf()

export default function CitizensChart({
  transfers,
  isLoading,
  height,
}: CitizensChartProps) {
  const stroke = 'white'
  const color = 'white'
  const bg = 'black'
  const fontSize = '0.75rem'

  const [range, setRange] = useTimelineRange({
    createdAt: 0,
  })

  const xDomain = useMemo(() => {
    const endOfDay = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60) // Round to midnight
    const startOfDay = endOfDay - +range * 24 * 60 * 60

    // Simply use the calculated start and end of day
    return [startOfDay, endOfDay] as [number, number]
  }, [range]) // Remove transfers from dependencies

  const xTicks = useTicks({
    range: xDomain,
    resolution: 7,
    offset: 0.5,
  })

  // Process transfers to create cumulative citizen count over time
  const processedPoints = useMemo(() => {
    if (!transfers?.length || isLoading) return []

    // Sort transfers by timestamp
    const sortedTransfers = [...transfers].sort(
      (a, b) => parseInt(a.blockTimestamp) - parseInt(b.blockTimestamp)
    )

    // Count transfers that happened before the range starts
    const transfersBeforeRange = sortedTransfers.filter(
      (transfer) => parseInt(transfer.blockTimestamp) < xDomain[0]
    )
    let cumulativeCount = transfersBeforeRange.length

    // Create points array with cumulative count
    const points: any[] = []

    // Add initial point at the start of the range with the count up to that point
    points.push({
      timestamp: xDomain[0],
      citizens: cumulativeCount,
    })

    // Add points for each transfer within the range
    sortedTransfers.forEach((transfer) => {
      const timestamp = parseInt(transfer.blockTimestamp)
      if (timestamp >= xDomain[0] && timestamp <= xDomain[1]) {
        cumulativeCount++
        points.push({
          timestamp,
          citizens: cumulativeCount,
        })
      }
    })

    // Add final point at the end of the range
    points.push({
      timestamp: xDomain[1],
      citizens: cumulativeCount,
    })

    return points
  }, [transfers, xDomain, isLoading])

  const yTicks = useMemo(() => {
    if (!processedPoints?.length) return [0, 1, 2, 3, 4, 5]

    const maxCitizens = Math.max(
      ...processedPoints.map((point) => point.citizens)
    )

    // Handle different scales more intelligently
    let roundedMax: number
    let tickCount = 5

    if (maxCitizens <= 10) {
      roundedMax = Math.ceil(maxCitizens)
      tickCount = roundedMax
    } else if (maxCitizens <= 100) {
      roundedMax = Math.ceil(maxCitizens / 10) * 10
    } else if (maxCitizens <= 1000) {
      roundedMax = Math.ceil(maxCitizens / 50) * 50
    } else {
      roundedMax = Math.ceil(maxCitizens / 100) * 100
    }

    const step = roundedMax / tickCount

    return Array.from({ length: tickCount + 1 }, (_, i) => Math.round(step * i))
  }, [processedPoints])

  const yDomain = useMemo(() => {
    if (!processedPoints?.length) return [0, 5]

    const maxCitizens = Math.max(
      ...processedPoints.map((point) => point.citizens)
    )

    // Ensure we have some padding at the top
    const maxTick = yTicks[yTicks.length - 1]
    return [0, Math.max(maxTick, maxCitizens * 1.1)]
  }, [yTicks, processedPoints])

  const allZeroValues = useMemo(() => {
    if (!processedPoints?.length) return true
    return processedPoints.every((point) => point.citizens === 0)
  }, [processedPoints])

  const dateStringForBlockTime = (timestampSecs: number) =>
    moment(timestampSecs * 1000).format('M/DD')

  return (
    <div id="citizens-timeline-chart">
      <div className="mt-8 w-full flex items-center justify-between gap-8">
        <div id="range-selector">
          <RangeSelector range={range} setRange={setRange} />
        </div>
      </div>
      <div className="mt-4 w-full relative">
        {!isLoading && transfers && allZeroValues && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
            <div
              className="text-white text-xl font-semibold font-GoodTimes"
              id="no-activity-message"
            >
              No Citizens Yet
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
          <LineChart
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
                dataKey="citizens"
                activeDot={{ r: 6, fill: '#6d3f79', stroke: undefined }}
                animationDuration={750}
              />
            )}
            <Tooltip
              cursor={{ stroke: color }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null

                const citizens = payload[0].payload.citizens

                return (
                  <div className="bg-smoke-100 p-2 text-sm dark:bg-slate-600">
                    <div className="text-grey-400 dark:text-slate-200">
                      {dateStringForBlockTime(payload[0].payload.timestamp)}
                    </div>
                    <div className="font-medium">{citizens} Citizens</div>
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
