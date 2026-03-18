import { RefObject, useEffect, useState } from 'react'

/**
 * Returns the number of list items that fit in a container based on its height.
 * Uses ResizeObserver to adapt when the container size changes (e.g. when
 * newsletters/proposals make adjacent content taller).
 */
export function useVisibleItemCount(
  containerRef: RefObject<HTMLElement | null>,
  options: {
    rowHeight?: number
    minCount?: number
    maxCount?: number
    headerOffset?: number
  } = {}
): number {
  const { rowHeight = 88, minCount = 2, maxCount = 12, headerOffset = 0 } = options
  const [count, setCount] = useState(maxCount)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const h = el.clientHeight - headerOffset
      if (h <= 0) return
      const n = Math.max(minCount, Math.min(maxCount, Math.floor(h / rowHeight)))
      setCount(n)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, rowHeight, minCount, maxCount, headerOffset])

  return count
}
