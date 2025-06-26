import { gsap } from 'gsap'
import { useMemo, useRef, useState, useEffect } from 'react'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MISSION_TOKEN_WEIGHTS } from '@/lib/mission/missionConfig'
import { truncateTokenValue } from '@/lib/utils/numbers'

export type MissionFundingMilestoneChartProps = {
  subgraphData: any
  fundingGoal: number
  height?: number
  projectId?: number
}

export default function MissionFundingMilestoneChart({
  subgraphData,
  fundingGoal,
  height = 300,
  projectId = 0,
}: MissionFundingMilestoneChartProps) {
  const stroke = 'white'
  const color = 'white'
  const bg = 'black'
  const fontSize = '0.75rem'

  const chartRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 0, left: 0 })

  const totalFunding = useTotalFunding(projectId)
  const volume = Number(totalFunding || 0) / 1e18

  const points = useMemo(() => {
    return [
      {
        target: 0,
        weight: MISSION_TOKEN_WEIGHTS[0],
        milestone: 1,
      },
      {
        target: truncateTokenValue((fundingGoal / 1e18) * 0.2, 'ETH'),
        weight: MISSION_TOKEN_WEIGHTS[1],
        milestone: 2,
      },
      {
        target: truncateTokenValue(fundingGoal / 1e18, 'ETH'),
        weight: MISSION_TOKEN_WEIGHTS[2],
        milestone: 3,
      },
      {
        target: truncateTokenValue((fundingGoal / 1e18) * 1.5, 'ETH'),
        label: 'UNLIMITED',
        targetLabel: '∞',
        weight: MISSION_TOKEN_WEIGHTS[2],
        milestone: 4,
      },
    ]
  }, [fundingGoal])

  const minTarget = points?.[0].target
  const midTarget = points?.[1].target
  const maxTarget = points?.[2].target

  // Helper function to generate the stepped line path for clipping
  const getSteppedLinePath = (points: any, volume: number) => {
    const maxChartTarget = Number(points[3].target)
    const cappedVolume = Math.min(volume, maxChartTarget)
    const progressWidth =
      (cappedVolume / maxChartTarget) * chartDimensions.width

    let path = ''
    let currentX = 0

    for (let i = 0; i < points.length - 1; i++) {
      const point = points[i]
      const nextPoint = points[i + 1]
      const pointX = (point.target / maxChartTarget) * chartDimensions.width
      const nextX = (nextPoint.target / maxChartTarget) * chartDimensions.width

      if (currentX <= progressWidth) {
        // Calculate Y position based on the weight (inverse, since SVG y increases downward)
        const y = height - (point.weight / 2000) * (height - 64) // Adjust based on your Y scale
        path += `${path ? 'L' : ''}${pointX},${y} L${Math.min(
          nextX,
          progressWidth
        )},${y} `
        currentX = nextX
      }
    }
    return path
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const updateChartDimensions = () => {
        const chartElement = document.querySelector('.recharts-wrapper')
        const plotArea = document.querySelector('.recharts-cartesian-grid')

        if (chartElement && plotArea) {
          const chartRect = chartElement.getBoundingClientRect()
          const plotRect = plotArea.getBoundingClientRect()

          setChartDimensions({
            width: plotRect.width,
            left: plotRect.left - chartRect.left,
          })
        }
      }

      updateChartDimensions()

      window.addEventListener('resize', updateChartDimensions)
      return () => window.removeEventListener('resize', updateChartDimensions)
    }, 100) // Short delay to ensure chart is rendered

    return () => clearTimeout(timeoutId)
  }, [])

  const progressPercent = (Math.min(volume, +maxTarget) / +maxTarget) * 100

  useEffect(() => {
    if (progressBarRef.current && chartDimensions.width > 0) {
      gsap.set(progressBarRef.current, { width: 0 })

      const maxChartTarget = Number(points[3].target) // 150% of funding goal
      const cappedVolume = Math.min(volume, maxChartTarget) // Cap at 150% of funding goal
      const targetWidth =
        (cappedVolume / maxChartTarget) * chartDimensions.width

      gsap.to(progressBarRef.current, {
        width: targetWidth,
        duration: 1.5,
        ease: 'power2.out',
        delay: 0.2,
        overwrite: true,
      })
    }
  }, [volume, chartDimensions.width, points])

  return (
    <div className="relative">
      {/* Progress bar with fixed positioning but dynamic width */}
      {chartDimensions.width > 0 && (
        <div
          id="funding-progress"
          ref={progressBarRef}
          className="absolute bg-gradient-to-r from-[#020617] to-[#475CE2] z-0"
          style={{
            left: `${chartDimensions.left}px`,
            top: '-52px', // Changed to cover the entire chart area
            bottom: '54px',
            opacity: 0.8,
            pointerEvents: 'none',
            clipPath: 'url(#progressStepClip)', // Apply the clip path
            // Width will be animated by GSAP using absolute pixel values
          }}
        />
      )}

      <ResponsiveContainer width="100%" height={height} ref={containerRef}>
        <LineChart
          ref={chartRef}
          data={points}
          margin={{
            top: 10,
            right: 24,
            bottom: 24,
            left: 0,
          }}
        >
          <defs>
            <clipPath id="progressClip">
              <rect x="0" y="0" width={`${progressPercent}%`} height="100%" />
            </clipPath>
            <clipPath id="progressStepClip">
              <path
                d={`M0,${height} ${getSteppedLinePath(
                  points,
                  volume
                )} V${height} Z`}
              />
            </clipPath>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="5%" stopColor="#425eeb" />
              <stop offset="90%" stopColor="#6d3f79" />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={stroke} strokeDasharray="1 2" />

          <YAxis
            label={{
              value: 'NUMBER OF TOKENS PER 1 ETH',
              angle: -90,
              position: 'bottomLeft',
            }}
            stroke={stroke}
            tickLine={false}
            tickSize={0}
            tick={(props) => {
              const { value } = props.payload
              const formattedValue = value.toFixed(value >= 10 ? 0 : 1)

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
            domain={[0, 2000]}
            ticks={[0, 500, 1000, 1500, 2000]}
            dataKey="weight"
          />

          <XAxis
            label={{
              value: 'ETH RAISED',
              position: 'bottomCenter',
              dy: 18,
            }}
            stroke={stroke}
            tick={(props) => (
              <g>
                <text
                  fontSize={fontSize}
                  fill={color}
                  transform={`translate(${props.x - 14},${props.y + 14})`}
                >
                  {`${Number(props.payload.value).toFixed(3)}`}
                </text>
              </g>
            )}
            tickLine={false}
            tickSize={0}
            dataKey="target"
            type="number"
            domain={[0, maxTarget]}
            ticks={[minTarget, midTarget, maxTarget]}
            allowDecimals={false}
          />

          <Line
            dot={true}
            stroke="url(#colorGradient)"
            strokeWidth={4}
            type="stepAfter"
            dataKey="weight"
            activeDot={{ r: 6, fill: '#6d3f79', stroke: undefined }}
            animationDuration={750}
          />
          <Tooltip
            cursor={{ stroke: color }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null

              const data = payload[0].payload
              return (
                <div className="bg-smoke-100 p-2 text-sm dark:bg-slate-600">
                  <div className="text-grey-400 dark:text-slate-200">
                    {data.label ? data.label : 'Milestone ' + data.milestone}
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    Target:{' '}
                    {data.targetLabel ? data.targetLabel : data.target + ' ETH'}
                  </div>
                  <div className="font-medium">
                    Rate: {data.weight.toLocaleString()} tokens/ETH
                  </div>
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
