import {
  TOUR_ACT_LABELS,
  TOUR_ORDER,
  TOUR_STOPS,
  type TourStopId,
} from '@/lib/moonbase-tour/stops'

type TourRailProps = {
  active: TourStopId | null
}

// Where you are on the tour and what is left, down the right edge. Every stop
// is a link to its own chapter, so the tour doubles as the page's contents.
export default function TourRail({ active }: TourRailProps) {
  const go = (id: TourStopId) => {
    const el = document.querySelector<HTMLElement>(`[data-tour-stop="${id}"]`)
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Moon Base Zero tour"
      className={`fixed right-6 top-1/2 z-20 hidden -translate-y-1/2 transition-opacity duration-500 lg:block ${
        active ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <ol className="flex flex-col items-end gap-3.5">
        {TOUR_ORDER.map((id, i) => {
          const isActive = id === active
          const act = TOUR_STOPS[id].act
          const startsAct = i === 0 || TOUR_STOPS[TOUR_ORDER[i - 1]].act !== act
          const inActiveAct = active != null && TOUR_STOPS[active].act === act
          return (
            <li key={id} className="flex flex-col items-end">
              {startsAct && (
                <span
                  className={`mb-2 font-RobotoMono text-[9px] uppercase tracking-[0.24em] transition-colors duration-300 ${
                    inActiveAct ? 'text-[#22d3ee]' : 'text-white/30'
                  } ${i === 0 ? '' : 'mt-3'}`}
                >
                  {TOUR_ACT_LABELS[act]}
                </span>
              )}
              <button
                type="button"
                onClick={() => go(id)}
                aria-current={isActive ? 'step' : undefined}
                className="group flex items-center gap-3"
              >
                <span
                  className={`font-RobotoMono text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
                    isActive
                      ? 'text-white opacity-100'
                      : 'text-white/50 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {TOUR_STOPS[id].label}
                </span>
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    isActive ? 'h-2.5 w-2.5 bg-[#22d3ee]' : 'h-1.5 w-1.5 bg-white/40 group-hover:bg-white/80'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
