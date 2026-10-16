import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { TOUR_POSTER, type TourStop } from '@/lib/moonbase-tour/stops'
import type { TourRenderMode } from './useTourRenderMode'

// The scene, its layout and the 5,700-line model library stay out of the
// tour's first-load bundle entirely.
const TourGlobe = dynamic(() => import('./TourGlobe'), { ssr: false })

type TourSceneProps = {
  stop: TourStop
  build: number | null
  // False once the page has scrolled past the last stop.
  visible: boolean
  mode: TourRenderMode | null
}

export default function TourScene({ stop, build, visible, mode }: TourSceneProps) {
  const [mountGlobe, setMountGlobe] = useState(false)
  const [ready, setReady] = useState(false)

  // The scene is a chain of fetches that each only start once the one before
  // has run: this chunk, the globe chunk inside it, then the terrain height map
  // the poster waits on. Start all three at once as soon as the page hydrates.
  useEffect(() => {
    if (mode !== 'globe' || mountGlobe) return
    void import('@/components/lunar-atlas/MoonGlobe')
    void import('@/components/lunar-atlas/useTerrainSampler').then((m) =>
      m.loadInnerField().catch(() => {})
    )
    setMountGlobe(true)
  }, [mode, mountGlobe])

  const still = stop.still ?? TOUR_POSTER

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Held invisible until the terrain is in, so the loading spinner and a
          half-built frame never show; the page's dark ground stands in. */}
      {mountGlobe && (
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <TourGlobe target={stop.target} build={build} onReady={() => setReady(true)} />
        </div>
      )}

      {mode === 'still' && (
        <div className="absolute inset-0">
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
      )}

      {/* The tour card sits on the left on desktop and along the bottom on
          phones; shade only that side so the camera's subject stays clear. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#010208]/80 to-transparent" />
      <div className="absolute inset-y-0 left-0 hidden w-[60%] bg-gradient-to-r from-[#010208]/80 via-[#010208]/40 to-transparent md:block" />
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-[#010208]/90 via-[#010208]/50 to-transparent md:h-32 md:from-[#010208]/60 md:via-transparent" />
    </div>
  )
}
