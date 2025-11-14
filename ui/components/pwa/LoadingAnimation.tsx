import { useEffect, useState } from 'react'
import Image from 'next/image'

interface LoadingAnimationProps {
  isLoading: boolean
  minDisplayTime?: number
}

export default function LoadingAnimation({
  isLoading,
  minDisplayTime = 1000,
}: LoadingAnimationProps) {
  const [showLoading, setShowLoading] = useState(isLoading)
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null)

  useEffect(() => {
    if (isLoading) {
      setShowLoading(true)
      setLoadingStartTime(Date.now())
    } else if (loadingStartTime) {
      // Ensure minimum display time for smooth UX
      const elapsed = Date.now() - loadingStartTime
      const remaining = Math.max(0, minDisplayTime - elapsed)

      setTimeout(() => {
        setShowLoading(false)
        setLoadingStartTime(null)
      }, remaining)
    }
  }, [isLoading, loadingStartTime, minDisplayTime])

  if (!showLoading) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 animate-fadeIn">
      <div className="flex flex-col items-center justify-center">
        {/* Animated SVG Logo */}
        <div className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48">
          <Image
            src="/assets/MoonDAO-Loading-Animation.svg"
            alt="Loading..."
            width={192}
            height={192}
            priority
            className="w-full h-full"
          />
        </div>

        {/* Optional loading text */}
        <p className="mt-6 text-white text-lg font-medium animate-pulse">
          Loading MoonDAO...
        </p>
      </div>
    </div>
  )
}

// Hook to use loading animation in your app
export function useAppLoading() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate app initialization
    // Replace with your actual loading logic
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return { isLoading, setIsLoading }
}

