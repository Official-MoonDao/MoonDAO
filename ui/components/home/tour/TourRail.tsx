import { TOUR_ORDER, TOUR_STOPS, type TourStopId } from '@/lib/home-tour/stops'

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
      <ol className="flex flex-col items-end gap-4">
        {TOUR_ORDER.map((id) => {
          const isActive = id === active
          return (
            <li key={id}>
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
