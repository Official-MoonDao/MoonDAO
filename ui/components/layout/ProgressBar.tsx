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
  const labelRef = useRef<HTMLSpanElement>(null)
  const previousProgress = useRef<number | null>(null)

  useEffect(() => {
    // Only animate if it's the first render or if progress changed significantly
    const isFirstRender = previousProgress.current === null
    const progressDiff = isFirstRender
      ? Infinity
      : Math.abs(progress - (previousProgress.current || 0))
    const shouldAnimate = isFirstRender || progressDiff >= 0.1 // Only animate if change is >= 0.1%

    if (shouldAnimate) {
      if (progressBarRef.current) {
        gsap.to(progressBarRef.current, {
          width: `${Math.min(progress, 100)}%`,
          duration: 2.5,
          ease: 'power1.inOut',
        })
      }

      if (labelRef.current) {
        gsap.to(labelRef.current, {
          opacity: 1,
          duration: 2.5,
          ease: 'power1.inOut',
        })
      }
    }

    // Update the previous progress value
    previousProgress.current = progress
  }, [progress, compact])

  return (
    <div
      className="relative w-full rounded-full"
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
        />
        {label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              ref={labelRef}
              className="text-[75%] text-white min-w-[10px] whitespace-nowrap opacity-0"
            >
              {label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
