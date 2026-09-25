import { useEffect, useState } from 'react'
import { LANDING_CHAPTERS } from './chapters'

/**
 * Fixed rail that tracks which chapter is on screen and jumps to any other.
 * Pointer-only and hidden on narrow viewports, where it would crowd the copy.
 */
export default function ChapterRail() {
  const [activeId, setActiveId] = useState(LANDING_CHAPTERS[0].id)

  useEffect(() => {
    // A centre band, rather than plain visibility, keeps exactly one chapter
    // active — tall sections would otherwise overlap and fight for the state.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )

    const observed = LANDING_CHAPTERS.map(({ id }) =>
      document.getElementById(id)
    ).filter((el): el is HTMLElement => el !== null)

    observed.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <nav
      aria-label="Page sections"
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-4 lg:flex"
    >
      {LANDING_CHAPTERS.map(({ id, label }) => {
        const isActive = id === activeId
        return (
          <button
            key={id}
            type="button"
            onClick={() => goTo(id)}
            aria-current={isActive ? 'true' : undefined}
            className="group flex items-center justify-end gap-3"
          >
            <span
              className={`whitespace-nowrap font-RobotoMono text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
                isActive
                  ? 'text-white/80'
                  : 'text-white/0 group-hover:text-white/60'
              }`}
            >
              {label}
            </span>
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? 'h-2.5 w-2.5 bg-[#7c8cff] shadow-[0_0_12px_rgba(124,140,255,0.9)]'
                  : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/60'
              }`}
            />
          </button>
        )
      })}
    </nav>
  )
}
