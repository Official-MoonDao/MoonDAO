import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'

interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string
  label?: string
  padding?: string
  compact?: boolean
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
  padding = '2px',
  compact = false,
}: ProgressBarProps) {
  const progressBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (progressBarRef.current) {
      gsap.to(progressBarRef.current, {
        width: `${Math.min(Math.max(progress, compact ? 0 : 10), 100)}%`,
        duration: 2.5,
        ease: 'power1.inOut',
      })
    }
  }, [progress, compact])

  return (
    <div
      className="relative w-full rounded-full bg-gradient-to-l from-[#425eeb] to-[#6d3f79]"
      style={{ height: `calc(${height} + ${padding} * 2)` }}
    >
      <div
        className="absolute inset-0 m-[2px] rounded-full bg-[#020617] overflow-hidden"
        style={{ margin: padding }}
      >
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-l from-[#425eeb] to-[#6d3f79] relative"
          style={{ width: '0%' }} // Start at 0 and let GSAP animate it
        >
          {label && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[75%] text-white min-w-[25px] whitespace-nowrap">
                {label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
