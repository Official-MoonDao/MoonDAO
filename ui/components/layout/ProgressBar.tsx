import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'

interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string
  label?: string
  padding?: string
  compact?: boolean
  isCelebrating?: boolean
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
  padding = '2px',
  compact = false,
  isCelebrating = false,
}: ProgressBarProps) {
  const progressBarRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const previousProgress = useRef<number | null>(null)
  const animationRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && animationRef.current) {
        animationRef.current.pause()
      } else if (!document.hidden && animationRef.current) {
        animationRef.current.resume()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (animationRef.current) {
        animationRef.current.kill()
      }
    }
  }, [])

  useEffect(() => {
    // Only animate if it's the first render or if progress changed significantly
    const isFirstRender = previousProgress.current === null
    const progressDiff = isFirstRender
      ? Infinity
      : Math.abs(progress - (previousProgress.current || 0))
    const shouldAnimate = isFirstRender || progressDiff >= 0.1 // Only animate if change is >= 0.1%

    if (shouldAnimate && !document.hidden) {
      if (progressBarRef.current) {
        if (animationRef.current) {
          animationRef.current.kill()
        }
        animationRef.current = gsap.to(progressBarRef.current, {
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
      className="relative w-full rounded-full bg-slate-700/30 border border-white/10 overflow-hidden"
      style={{ height: `calc(${height} + ${padding} * 2)` }}
    >
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{ margin: padding }}
      >
        {/* Background with subtle pattern */}
        <div className="h-full w-full bg-gradient-to-r from-slate-800/50 to-slate-700/50 relative">
          {/* Progress fill with enhanced gradient */}
          <div
            ref={progressBarRef}
            className={`h-full relative shadow-lg ${
              isCelebrating
                ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500'
                : 'bg-gradient-to-r from-blue-500 via-purple-600 to-blue-500'
            }`}
            style={{ width: '0%' }} // Start at 0 and let GSAP animate it
          >
            {/* Shimmer effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>

          {/* Progress label */}
          {label && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                ref={labelRef}
                className="text-sm font-medium text-white drop-shadow-lg opacity-0 px-2 py-1 bg-black/20 rounded-full backdrop-blur-sm"
              >
                {label}
              </span>
            </div>
          )}

          {/* Subtle highlight on top edge */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      </div>
    </div>
  )
}
