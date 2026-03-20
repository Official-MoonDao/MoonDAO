import React from 'react'
import { useFitSingleLineFontPx } from '@/lib/utils/hooks/useFitSingleLineFontPx'

type MissionSingleLineTitleProps = {
  text: string
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  /** Floor (px) — keep above subtitle scale (e.g. base/lg ~16–18px). */
  minPx: number
  /** Ceiling (px) — try this first when width allows. */
  maxPx: number
  className?: string
  /** Must match heading typography for width measurement (font, weight, tracking). */
  metricsClassName?: string
  'data-testid'?: string
}

/**
 * One-line mission title: as large as fits in the container (no ellipsis, no horizontal scroll).
 */
export default function MissionSingleLineTitle({
  text,
  as = 'h1',
  minPx,
  maxPx,
  className = '',
  metricsClassName = 'tracking-tight',
  'data-testid': dataTestId,
}: MissionSingleLineTitleProps) {
  const measureClassName = `font-GoodTimes leading-tight ${metricsClassName}`.trim()
  const { containerRef, measureRef, fontSizePx } = useFitSingleLineFontPx(
    text,
    minPx,
    maxPx,
    measureClassName
  )

  const Heading = as

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <span
        ref={measureRef}
        className={`pointer-events-none absolute left-0 top-0 -z-10 whitespace-nowrap opacity-0 ${measureClassName}`}
        aria-hidden
      >
        {text}
      </span>
      <Heading
        data-testid={dataTestId}
        className={`font-GoodTimes text-white leading-tight whitespace-nowrap ${metricsClassName} ${className}`.trim()}
        style={{ fontSize: `${fontSizePx}px` }}
      >
        {text}
      </Heading>
    </div>
  )
}
