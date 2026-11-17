import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'moonbase:intro-strip-dismissed'

// First-visit visitors kept asking "is it a game or what?". Three steps, in the
// order someone actually uses the page, until they close it.
const STEPS = [
  { title: 'Explore the base', detail: 'Drag to look around' },
  { title: 'Pick a race', detail: 'Each site is a real race to the Moon' },
  { title: 'Predict the winner', detail: "It's free to predict" },
]

/**
 * Floats over the scene instead of sitting in the page flow, so closing it
 * never shifts the intro card or the race list. Top-centre where it fits
 * between those two (>= 1400px); otherwise just above the timeline.
 */
export default function IntroStrip({ panelOpen = false }: { panelOpen?: boolean }) {
  // Hidden until mounted, so the server markup and a returning visitor who
  // dismissed it never disagree (no hydration mismatch, no flash).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // Storage blocked: show it; dismissing then only lasts for this visit.
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage blocked: dismissed for this visit only.
    }
  }

  return (
    <div
      className={`pointer-events-auto absolute bottom-[8.5rem] left-1/2 z-10 w-[min(92vw,720px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-cyan-300/25 bg-black/70 py-2 pl-3 pr-1.5 backdrop-blur-md sm:gap-3 sm:pl-4 min-[1400px]:bottom-auto min-[1400px]:top-6 min-[1400px]:w-[min(calc(100%-53rem),46rem)] ${
        // On phones an open race panel is a bottom sheet right where this
        // sits; by then the visitor has found their way in anyway.
        panelOpen ? 'hidden sm:flex' : 'flex'
      }`}
    >
      <ol className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-[11px] font-bold text-black">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold leading-tight text-white sm:text-sm">
                {step.title}
              </span>
              <span className="hidden truncate text-[11px] leading-tight text-white/55 sm:block">
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
