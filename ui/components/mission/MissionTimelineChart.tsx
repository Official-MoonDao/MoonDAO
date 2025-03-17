import { CalendarDateRangeIcon } from '@heroicons/react/24/outline'
import moment from 'moment'
import Image from 'next/image'
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
import { wadToFloat } from '@/lib/utils/numbers'
import { daysToMS } from '@/lib/utils/timestamp'
import RangeSelector from '../layout/RangeSelector'
import MissionTimelineViewSelector from './MissionTimelineViewSelector'

export type MissionTimelineChartProps = {
  points: any[]
  height: number
  createdAt: number
}

const now = Date.now().valueOf()

export default function MissionTimelineChart({
  points,
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

  const defaultYDomain = useTimelineYDomain(points?.map((point) => point[view]))

  const { trendingProjects } = useJBTrendingProjects()
  const highTrendingScore = trendingProjects?.length
    ? wadToFloat(trendingProjects[0].trendingScore)
    : undefined
  const highTrendingPoint =
    points?.reduce(
      (acc, curr) => (curr.trendingScore > acc ? curr.trendingScore : acc),
      0
    ) ?? 0

  const yDomain: [number, number] =
    view === 'trendingScore' && highTrendingScore
      ? [
          defaultYDomain[0],
          Math.max(highTrendingScore, highTrendingPoint) * 1.05,
        ]
      : defaultYDomain

  const xDomain = useMemo(
    () =>
      [Math.floor((now - daysToMS(range)) / 1000), Math.floor(now / 1000)] as [
        number,
        number
      ],
    [range]
  )

  const xTicks = useTicks({ range: xDomain, resolution: 7, offset: 0.5 })

  const yTicks = useTicks({ range: yDomain, resolution: 5, offset: 0.5 })

  const dateStringForBlockTime = (timestampSecs: number) =>
    moment(timestampSecs * 1000).format('M/DD')

  return (
    <div>
      <div className="mt-8 w-full flex items-center justify-between gap-8">
        <RangeSelector range={range} setRange={setRange} />
        <div className="flex items-center gap-2">
          <CalendarDateRangeIcon className="w-5 h-5" />
          <span className="text-sm">
            {`Created ${new Date(createdAt * 1000).toLocaleDateString()}`}
          </span>
        </div>
      </div>
      <ResponsiveContainer className="mt-4 w-full" height={height}>
        <LineChart
          margin={{
            top: -1, // hacky way to hide top border of CartesianGrid
            right: 0,
            bottom: 0,
            left: 1, // ensure y axis isn't cut off
          }}
          data={points}
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
              if (view === 'trendingScore' || !points?.length) return <g></g>

              const { value } = props.payload

              let formattedValue
              if (value < 0.0001) {
                formattedValue = value.toFixed(6)
              } else if (value < 0.001) {
                formattedValue = value.toFixed(5)
              } else if (value < 0.01) {
                formattedValue = value.toFixed(4)
              } else if (value < 0.1) {
                formattedValue = value.toFixed(3)
              } else if (value < 1) {
                formattedValue = value.toFixed(2)
              } else {
                formattedValue = value.toFixed(value >= 10 ? 0 : 1)
              }

              // <rect> serves as a mask to prevent CartesianGrid lines overlapping tick text
              return (
                <g>
                  <rect
                    transform={`translate(${props.x},${props.y - 6})`}
                    height={12}
                    // Adjust width based on text length
                    width={formattedValue.length * 8}
                    fill={bg}
                  />
                  <text
                    fontSize={fontSize}
                    fill={color}
                    transform={`translate(${props.x + 4},${props.y + 4})`}
                  >
                    {'ETH'}
                    <Image
                      src={`/coins/ETH.svg`}
                      width={20}
                      height={20}
                      alt=""
                    />
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
            interval={0} // Ensures all ticks are visible
            tickLine={false}
            tickSize={0}
            type="number"
            dataKey="timestamp"
            allowDataOverflow={true}
          />
          {view === 'trendingScore' && highTrendingScore && points?.length && (
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
          {points?.length && (
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
                      {'ETH'}
                      <Image
                        src={`/coins/ETH.svg`}
                        width={20}
                        height={20}
                        alt=""
                      />
                      {amount.toFixed(amount > 10 ? 1 : amount > 1 ? 2 : 4)}
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
  )
}
