import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Clears the fixed top nav (4rem) plus a small gap. */
const STICK_TOP = 80
/** A column taller than the viewport pins by its bottom edge instead. */
const BOTTOM_GAP = 16

type Mode = 'flow' | 'pinned'

/**
 * Keeps the prize column on screen while the left column is in view.
 * The column is taken out of the page with position:fixed. CSS sticky never
 * fires here: html, body, and #main-container are the scroll containers.
 */
export default function StickyRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<Mode>('flow')
  const [mode, setMode] = useState<Mode>('flow')
  const [box, setBox] = useState({ left: 0, width: 0, top: STICK_TOP, height: 0 })

  useEffect(() => {
    const rail = railRef.current
    const panel = panelRef.current
    if (!rail || !panel) return

    let frame = 0
    const update = () => {
      frame = 0
      const wide = window.matchMedia('(min-width: 1024px)').matches
      const grid = rail.parentElement
      if (!wide || !grid) {
        if (modeRef.current !== 'flow') {
          modeRef.current = 'flow'
          setMode('flow')
        }
        return
      }

      const gridRect = grid.getBoundingClientRect()
      const railRect = rail.getBoundingClientRect()
      const height = panel.offsetHeight
      if (height <= 0 || railRect.width <= 0) return

      const fitsViewport = STICK_TOP + height + BOTTOM_GAP <= window.innerHeight
      const pinTop = fitsViewport ? STICK_TOP : window.innerHeight - BOTTOM_GAP - height
      const next: Mode = gridRect.top >= pinTop ? 'flow' : 'pinned'
      const top = next === 'pinned' ? Math.min(pinTop, gridRect.bottom - height) : pinTop

      if (next !== modeRef.current) {
        modeRef.current = next
        setMode(next)
      }
      if (next === 'pinned') {
        const left = railRect.left
        const width = railRect.width
        setBox((prev) =>
          prev.left === left && prev.width === width && prev.top === top && prev.height === height
            ? prev
            : { left, width, top, height }
        )
      }
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const panelStyle: CSSProperties | undefined =
    mode === 'pinned'
      ? { position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex: 30 }
      : undefined

  return (
    <aside
      ref={railRef}
      className="relative min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2"
    >
      {mode === 'pinned' && <div aria-hidden="true" style={{ height: box.height }} />}
      <div ref={panelRef} style={panelStyle}>
        {children}
      </div>
    </aside>
  )
}
