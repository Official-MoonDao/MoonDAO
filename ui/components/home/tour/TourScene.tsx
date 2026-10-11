import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { TOUR_POSTER, type TourStop } from '@/lib/home-tour/stops'
import type { TourRenderMode } from './useTourRenderMode'

// The scene, its layout and the 5,700-line model library stay out of the
// homepage's first-load bundle entirely.
const TourGlobe = dynamic(() => import('./TourGlobe'), { ssr: false })

type TourSceneProps = {
  stop: TourStop
  year: number | null
  // False once the page has scrolled past the last stop.
  visible: boolean
  mode: TourRenderMode | null
}

export default function TourScene({ stop, year, visible, mode }: TourSceneProps) {
  const [mountGlobe, setMountGlobe] = useState(false)
  const [ready, setReady] = useState(false)

  // Start fetching the scene only once the hero has painted and the main
  // thread has a moment, so it never competes with the copy for first load.
  useEffect(() => {
    if (mode !== 'globe' || mountGlobe) return
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setMountGlobe(true), { timeout: 2500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = setTimeout(() => setMountGlobe(true), 1200)
    return () => clearTimeout(t)
  }, [mode, mountGlobe])

  const still = mode === 'still' ? stop.still ?? TOUR_POSTER : TOUR_POSTER
  const showPoster = mode !== 'globe' || !ready

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {mountGlobe && (
        <div className="absolute inset-0">
          <TourGlobe target={stop.target} year={year} onReady={() => setReady(true)} />
        </div>
      )}

      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          showPoster ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Image
          key={still}
          src={still}
          alt=""
          fill
          priority
          sizes="100vw"
          className="animate-fadeIn object-cover"
          style={{ objectPosition: 'center 75%' }}
        />
      </div>

      {/* The tour card sits on the left on desktop and along the bottom on
          phones; shade only that side so the camera's subject stays clear. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#010208]/80 to-transparent" />
      <div className="absolute inset-y-0 left-0 hidden w-[60%] bg-gradient-to-r from-[#010208]/80 via-[#010208]/40 to-transparent md:block" />
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-[#010208]/90 via-[#010208]/50 to-transparent md:h-32 md:from-[#010208]/60 md:via-transparent" />
    </div>
  )
}
