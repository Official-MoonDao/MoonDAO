import { ReactNode, useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { classNames } from '@/lib/utils/tailwind'

export interface VotingProgressBarProps {
  percentage: number
  color?: string
  backgroundColor?: string
  height?: string
  showTooltip?: boolean
  tooltipContent?: ReactNode
  className?: string
}

export default function VotingProgressBar({
  percentage,
  color = 'bg-green-500',
  backgroundColor = 'bg-gray-200',
  height = 'h-2',
  showTooltip = false,
  tooltipContent,
  className = '',
}: VotingProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  return (
    <div
      className={classNames(
        'w-full rounded-full',
        backgroundColor,
        height,
        className
      )}
    >
      <div
        className={classNames(
          'rounded-full transition-all duration-300',
          color,
          height
        )}
        style={{ width: `${clampedPercentage}%` }}
        title={
          showTooltip
            ? String(tooltipContent || `${clampedPercentage.toFixed(1)}%`)
            : undefined
        }
      />
    </div>
  )
}
export interface MultiProgressBarProps {
  segments: {
    percentage: number
    color: string
    label?: string
  }[]
  height?: string
  backgroundColor?: string
  className?: string
}

export function MultiVotingProgressBar({
  segments,
  height = 'h-2',
  backgroundColor = 'bg-gray-200',
  className = '',
}: MultiProgressBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const normalizedSegments = useMemo(() => {
    const totalPercentage = segments.reduce(
      (sum, segment) => sum + segment.percentage,
      0
    )
    return segments.map((segment) => ({
      ...segment,
      normalizedPercentage:
        totalPercentage > 0 ? (segment.percentage / totalPercentage) * 100 : 0,
    }))
  }, [segments])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (hoveredIndex !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const segmentOffset = normalizedSegments
        .slice(0, hoveredIndex)
        .reduce((sum, seg) => sum + seg.normalizedPercentage, 0)
      const segmentCenter =
        segmentOffset +
        normalizedSegments[hoveredIndex].normalizedPercentage / 2

      setTooltipPosition({
        x: rect.left + (rect.width * segmentCenter) / 100,
        y: rect.top - 10,
      })
    }
  }, [hoveredIndex, normalizedSegments])

  const renderTooltip = () => {
    if (
      !mounted ||
      hoveredIndex === null ||
      !normalizedSegments[hoveredIndex] ||
      !normalizedSegments[hoveredIndex].label
    ) {
      return null
    }

    return createPortal(
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          transform: 'translateX(-50%) translateY(-100%)',
        }}
      >
        <div className="bg-white text-black px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg border">
          {normalizedSegments[hoveredIndex].label}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={classNames(
          'w-full rounded-full flex',
          backgroundColor,
          height,
          className
        )}
      >
        {normalizedSegments.map((segment, index) => (
          <div
            key={index}
            className={classNames(
              'transition-all duration-300 cursor-pointer',
              segment.color,
              index === 0 ? 'rounded-l-full' : '',
              index === normalizedSegments.length - 1 ? 'rounded-r-full' : ''
            )}
            style={{ width: `${segment.normalizedPercentage}%` }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>

      {renderTooltip()}
    </div>
  )
}
