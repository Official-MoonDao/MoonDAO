import { useEffect, useRef, useState } from 'react'

export function useSwipeDirection() {
  const clientX = useRef<number | null>()
  const [swipeDirection, setSwipeDirection] = useState<
    'left' | 'right' | null
  >()

  function handleTouchStart({ touches }: TouchEvent) {
    clientX.current = touches[0].clientX
  }

  function handleTouchMove({ touches }: TouchEvent) {
    if (clientX.current) {
      const delta = touches[0].clientX - clientX.current

      if (delta < -100) {
        setSwipeDirection('left')
      }

      if (delta > 100) {
        setSwipeDirection('right')
      }
    }
  }

  function handleTouchEnd({ touches }: TouchEvent) {
    clientX.current = null
    setSwipeDirection(null)
  }

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return swipeDirection
}
