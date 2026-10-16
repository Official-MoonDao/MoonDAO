import { useEffect, useState } from 'react'

// Which tour stop owns the middle of the viewport, by the `data-tour-stop`
// attribute on its wrapper. Null once the page has scrolled past every stop
// (the footer).
//
// A change only lands after `holdMs` without another one, so flicking the
// page past three sections flies the camera to the last of them instead of
// starting three flights.
export default function useActiveStop<T extends string>(
  initial: T,
  holdMs = 150
): T | null {
  const [active, setActive] = useState<T | null>(initial)

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('[data-tour-stop]')
    )
    const hits = new Map<Element, boolean>()
    let timer: ReturnType<typeof setTimeout> | undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) hits.set(e.target, e.isIntersecting)
        const el = els.find((e) => hits.get(e))
        const next = (el?.dataset.tourStop ?? null) as T | null
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => setActive(next), holdMs)
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [holdMs])

  return active
}
