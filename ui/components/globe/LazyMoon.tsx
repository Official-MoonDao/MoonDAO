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
  const [isVisible, setIsVisible] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full">
      {isVisible && !isPaused && <Moon />}
      {isVisible && isPaused && (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-br from-gray-700/30 to-gray-900/30" />
        </div>
      )}
    </div>
  )
}

