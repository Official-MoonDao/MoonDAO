import React from 'react'
import { TokenDistributionSegment } from '@/lib/mooney/utils/tokenData'
import { TOTAL_SUPPLY_DISPLAY } from '@/lib/mooney/utils/tokenData'

export interface TokenDistributionChartProps {
  data: TokenDistributionSegment[]
  totalSupply?: string
}

export default function TokenDistributionChart({
  data,
  totalSupply = TOTAL_SUPPLY_DISPLAY,
}: TokenDistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let cumulativePercentage = 0

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      <div className="relative w-64 h-64 flex-shrink-0">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 200 200"
        >
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="#1F2937"
            strokeWidth="2"
          />
          {data.map((segment, index) => {
            const percentage = (segment.value / total) * 100
            const strokeDasharray = `${percentage * 5.65} ${
              565 - percentage * 5.65
            }`
            const strokeDashoffset = -cumulativePercentage * 5.65
            cumulativePercentage += percentage

            return (
              <circle
                key={index}
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke={segment.color}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 hover:stroke-width-[25]"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl font-bold text-white">{totalSupply}</div>
            <div className="text-xs text-gray-400">Total Supply</div>
          </div>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {data.map((segment, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: segment.color }}
            ></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="text-white font-medium text-sm">
                  {segment.name}
                  <span className="text-gray-300 font-normal">
                    : {segment.description}
                  </span>
                </div>
                <div className="text-white font-bold text-sm">
                  {segment.value.toFixed(2)}%
                </div>
              </div>
              <div className="text-gray-400 text-xs">
                {segment.amount.toFixed(0)}M MOONEY
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

