import React from 'react'
import { QuarterlyDataPoint } from '@/lib/mooney/utils/geometricDecay'

export interface GeometricDecayChartProps {
  data: QuarterlyDataPoint[]
  reductionRate?: number
}

export default function GeometricDecayChart({
  data,
  reductionRate = 0.05,
}: GeometricDecayChartProps) {
  if (!data || data.length === 0) return null

  const chartWidth = 340
  const chartHeight = 130

  const pathData = data
    .map((point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`
      const prevPoint = data[i - 1]
      const cp1x = prevPoint.x + (point.x - prevPoint.x) / 3
      const cp1y = prevPoint.y
      const cp2x = point.x - (point.x - prevPoint.x) / 3
      const cp2y = point.y
      return `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${point.x} ${point.y}`
    })
    .join(' ')

  const areaPath = `${pathData} L ${data[data.length - 1].x} 115 L ${data[0].x} 115 Z`

  const yLabels = [
    { value: 15_000_000, y: 30 },
    { value: 14_000_000, y: 50 },
    { value: 13_000_000, y: 70 },
    { value: 12_000_000, y: 90 },
    { value: 11_000_000, y: 110 },
  ]

  return (
    <div className="h-52 bg-gray-900/80 rounded-lg p-2 relative overflow-hidden border border-gray-700/50">
      <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <defs>
          <pattern
            id="grid"
            width="32"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 24"
              fill="none"
              stroke="#374151"
              strokeWidth="0.5"
              opacity="0.2"
            />
          </pattern>
          <linearGradient
            id="areaGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              style={{
                stopColor: '#F59E0B',
                stopOpacity: 0.3,
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: '#F59E0B',
                stopOpacity: 0.05,
              }}
            />
          </linearGradient>
        </defs>
        <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />

        {yLabels.map((label, i) => (
          <text
            key={i}
            x="20"
            y={label.y}
            fontSize="10"
            fill="#9CA3AF"
            textAnchor="middle"
          >
            {label.value >= 1_000_000
              ? `${(label.value / 1_000_000).toFixed(0)}M`
              : `${(label.value / 1_000).toFixed(0)}K`}
          </text>
        ))}

        <path d={areaPath} fill="url(#areaGradient)" />

        <path
          d={pathData}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <line
          x1="35"
          y1="115"
          x2="315"
          y2="115"
          stroke="#4B5563"
          strokeWidth="1"
        />

        <line
          x1="35"
          y1="25"
          x2="35"
          y2="115"
          stroke="#4B5563"
          strokeWidth="1"
        />

        {data.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#1F2937"
              stroke="#F59E0B"
              strokeWidth="2"
            />
            <circle cx={point.x} cy={point.y} r="1.5" fill="#F59E0B" />
            <text
              x={point.x}
              y={point.y - 12}
              fontSize="9"
              fill="#D1D5DB"
              textAnchor="middle"
              fontWeight="500"
            >
              {point.quarter}
            </text>
            {i !== 0 && (
              <text
                x={point.x}
                y={point.y + 18}
                fontSize="8"
                fill="#9CA3AF"
                textAnchor="middle"
              >
                {point.valueDisplay}
              </text>
            )}
          </g>
        ))}

        <text
          x="300"
          y="20"
          fontSize="10"
          fill="#F59E0B"
          textAnchor="end"
          fontWeight="600"
        >
          -{reductionRate * 100}% per quarter
        </text>
      </svg>
    </div>
  )
}

