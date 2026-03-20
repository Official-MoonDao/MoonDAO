import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Largest font size (px) so measured text fits container width on one line.
 * Waits for webfonts and re-runs on resize.
 */
export function useFitSingleLineFontPx(
  text: string | undefined,
  minPx: number,
  maxPx: number,
  /** When heading metrics classes change, re-measure. */
  layoutKey: string
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [fontSizePx, setFontSizePx] = useState(maxPx)

  useLayoutEffect(() => {
    if (!text) return
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    let cancelled = false

    const compute = () => {
      if (cancelled) return
      const maxW = container!.clientWidth
      if (maxW <= 0) return

      let low = minPx
      let high = maxPx
      let best = minPx

      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2
        measure!.style.fontSize = `${mid}px`
        const w = measure!.scrollWidth
        if (w <= maxW) {
          best = mid
          low = mid
        } else {
          high = mid
        }
      }

      measure!.style.fontSize = `${best}px`
      let w = measure!.scrollWidth
      if (w > maxW && w > 0) {
        best *= (maxW / w) * 0.99
      }

      setFontSizePx(Math.max(minPx, Math.min(maxPx, best)))
    }

    const run = () => {
      void document.fonts.ready.then(() => {
        if (!cancelled) compute()
      })
    }

    run()
    const ro = new ResizeObserver(() => run())
    ro.observe(container)
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [text, minPx, maxPx, layoutKey])

  return { containerRef, measureRef, fontSizePx }
}
