import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'

const Earth = dynamic(() => import('./Earth'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative">
        <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-sm md:text-base opacity-70">Loading Globe...</div>
        </div>
      </div>
    </div>
  ),
})

type LazyEarthProps = {
  pointsData: any[]
  width?: number
  height?: number
}

export default function LazyEarth({ pointsData, width, height }: LazyEarthProps) {
  // Once the globe has been mounted we keep it mounted. Unmounting it (e.g.
  // when the browser tab is hidden or the element scrolls out of view) tears
  // down the WebGL context and replays the intro/`pointOfView` animation when
  // it comes back, which looks like the map "reloading" or "spinning back".
  const [hasMounted, setHasMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true)
          // We only need to defer the initial mount; once visible we keep the
          // globe alive, so stop observing.
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full">
      {hasMounted && <Earth pointsData={pointsData} width={width} height={height} />}
    </div>
  )
}

