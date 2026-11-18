import { useEffect, useRef, useState } from 'react'

type Heading = { id: string; text: string }

const PIN_TOP = 96

/**
 * Reads the rendered `h2[id]`s so the links always match the ids rehype-slug
 * produced, then tracks the section nearest the top of the viewport.
 *
 * The page layout wraps everything in an `overflow-x-hidden` container, which
 * disables `position: sticky`, so the nav is pinned by translating it within
 * its grid cell instead.
 */
export default function UpdateToc({ articleId }: { articleId: string }) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = document.getElementById(articleId)
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2[id]'))
    setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent || '' })))

    const ids = nodes.map((n) => n.id)
    function onScroll() {
      let current: string | null = ids[0] ?? null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 140) current = id
        else break
      }
      setActive(current)
    }
    onScroll()
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [articleId])

  useEffect(() => {
    const nav = navRef.current
    const cell = nav?.parentElement
    if (!nav || !cell) return
    let frame = 0
    function pin() {
      frame = 0
      if (!nav || !cell) return
      const room = cell.getBoundingClientRect()
      const offset = Math.max(0, Math.min(PIN_TOP - room.top, room.height - nav.offsetHeight))
      nav.style.transform = offset ? `translateY(${offset}px)` : ''
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(pin)
    }
    pin()
    document.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
    }
  }, [headings.length])

  if (headings.length < 3) return null

  return (
    <nav ref={navRef} aria-label="On this page" className="will-change-transform">
      <p className="mb-4 font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-slate-500">
        On this page
      </p>
      <ol className="space-y-0.5 border-l border-white/10">
        {headings.map((h) => {
          const on = h.id === active
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={`-ml-px block border-l py-1.5 pl-4 text-[13px] leading-snug transition-colors ${
                  on
                    ? 'border-blue-400 font-medium text-white'
                    : 'border-transparent text-slate-400 hover:border-white/30 hover:text-slate-200'
                }`}
              >
                {h.text}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
