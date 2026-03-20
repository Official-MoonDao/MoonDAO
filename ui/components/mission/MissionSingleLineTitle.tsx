import React, { useLayoutEffect, useState } from 'react'
import { useFitSingleLineFontPx } from '@/lib/utils/hooks/useFitSingleLineFontPx'

/** Below this container width, allow the title to wrap to multiple lines (avoids overflow on phones / narrow columns). */
const WRAP_TITLE_MAX_CONTAINER_PX = 640

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
 * Mission title sized to fit the container on one line when there is room; below ~sm width the
 * container may wrap to multiple lines so long titles do not overflow horizontally.
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

  const [allowWrap, setAllowWrap] = useState(false)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      setAllowWrap(el.clientWidth > 0 && el.clientWidth < WRAP_TITLE_MAX_CONTAINER_PX)
    }
    update()

    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update())
      ro.observe(el)
    }

    return () => {
      if (ro) ro.disconnect()
    }
  }, [text, minPx, maxPx, measureClassName])

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
        className={`font-GoodTimes text-white leading-tight ${metricsClassName} ${className} ${
          allowWrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'
        }`.trim()}
        style={{ fontSize: `${fontSizePx}px` }}
      >
        {text}
      </Heading>
    </div>
  )
}
