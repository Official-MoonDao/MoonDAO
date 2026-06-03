import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'

const Moon = dynamic(() => import('./Moon'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative">
        <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-br from-gray-700/30 to-gray-900/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-sm md:text-base opacity-70">Loading Moon...</div>
        </div>
      </div>
    </div>
  ),
})

export default function LazyMoon() {
  // Keep the globe mounted once it has appeared. Unmounting it when the tab is
  // hidden or it scrolls out of view tears down the WebGL context and replays
  // the intro animation on return, which looks like the map "reloading".
  const [hasMounted, setHasMounted] = useState(false)
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
      { threshold: 0.1 }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full">
      {hasMounted && <Moon />}
    </div>
  )
}

