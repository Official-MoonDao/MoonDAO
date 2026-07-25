import {
  ComponentType,
  useEffect,
  useState,
  useRef,
} from 'react'

type EarthProps = {
  pointsData: any[]
  width?: number
  height?: number
}

type LazyEarthProps = EarthProps

function GlobePlaceholder() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative">
        <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-sm md:text-base opacity-70">
            Loading Globe...
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Defer the react-globe.gl / Three.js chunk until the map is near the viewport.
 *
 * Important: do NOT use `next/dynamic(() => import('./Earth'))` at module scope.
 * When SignedInDashboard is itself dynamically imported, webpack treats that
 * nested dynamic as part of the same async graph and downloads+parses the
 * ~1.4MB globe chunk during the dashboard spinner — freezing the tab with
 * "Page Unresponsive" before the user ever scrolls to the map.
 *
 * A runtime `import()` inside the visibility effect keeps the globe chunk off
 * the SignedInDashboard load path entirely.
 */
export default function LazyEarth({ pointsData, width, height }: LazyEarthProps) {
  // Once the globe has been mounted we keep it mounted. Unmounting it (e.g.
  // when the browser tab is hidden or the element scrolls out of view) tears
  // down the WebGL context and replays the intro/`pointOfView` animation when
  // it comes back, which looks like the map "reloading" or "spinning back".
  const [hasMounted, setHasMounted] = useState(false)
  const [Earth, setEarth] = useState<ComponentType<EarthProps> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '200px 0px' }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!hasMounted || Earth) return

    let cancelled = false
    import('./Earth')
      .then((mod) => {
        if (!cancelled) {
          setEarth(() => mod.default)
        }
      })
      .catch((err) => {
        console.warn('Failed to load globe chunk:', err)
      })

    return () => {
      cancelled = true
    }
  }, [hasMounted, Earth])

  return (
    <div ref={containerRef} className="w-full h-full">
      {hasMounted && Earth ? (
        <Earth pointsData={pointsData} width={width} height={height} />
      ) : (
        <GlobePlaceholder />
      )}
    </div>
  )
}
