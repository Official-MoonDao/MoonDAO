import { RefObject, useEffect, useState } from 'react'

/**
 * Latches to `true` the first time `ref` intersects the viewport (with an
 * optional rootMargin so near-viewport items warm early). Once true, stays
 * true — scrolling away must not tear down expensive work and re-fire it.
 */
export function useOnceVisible(
  ref: RefObject<Element | null>,
  { rootMargin = '200px 0px', enabled = true }: { rootMargin?: string; enabled?: boolean } = {}
): boolean {
  const [visible, setVisible] = useState(!enabled)

  useEffect(() => {
    if (!enabled) {
      setVisible(true)
      return
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    let cancelled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (cancelled) return
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold: 0 }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [ref, rootMargin, enabled])

  return visible
}
