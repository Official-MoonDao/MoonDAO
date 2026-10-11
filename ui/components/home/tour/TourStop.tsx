import { ReactNode } from 'react'
import type { TourStop as TourStopData } from '@/lib/home-tour/stops'

type TourStopProps = {
  stop: TourStopData
  children: ReactNode
  // An open stretch of page above the copy where the base is seen unobscured
  // as the camera arrives. The hero has none: it opens on the base already.
  showWindow?: boolean
  // The dark band behind the copy. Off for a section that grades its own;
  // light for one whose copy already sits on its own cards.
  veil?: boolean | 'light'
}

const VEIL_CLASS = {
  full: 'bg-[linear-gradient(to_bottom,transparent,rgba(1,2,8,0.8)_12%,rgba(1,2,8,0.8)_88%,transparent)]',
  light: 'bg-[linear-gradient(to_bottom,transparent,rgba(1,2,8,0.4)_12%,rgba(1,2,8,0.4)_88%,transparent)]',
}

export default function TourStop({
  stop,
  children,
  showWindow = true,
  veil = true,
}: TourStopProps) {
  return (
    <div data-tour-stop={stop.id} className="relative">
      {showWindow && (
        <div className="flex h-[55svh] items-end px-5 pb-10 md:px-10">
          {stop.label && (
            <span className="mx-auto inline-flex w-full max-w-[1400px] items-center gap-2.5 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee]/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
              </span>
              Moon Base Zero · {stop.label}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        {veil && (
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${
              veil === 'light' ? VEIL_CLASS.light : VEIL_CLASS.full
            }`}
          />
        )}
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}
