import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePageVisibilityOptions {
  onHidden?: () => void
  onVisible?: () => void
}

export function usePageVisibility(options?: UsePageVisibilityOptions) {
  const [isPageVisible, setIsPageVisible] = useState(true)
  const { onHidden, onVisible } = options || {}

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden
      setIsPageVisible(!hidden)

      if (hidden) {
        onHidden?.()
      } else {
        onVisible?.()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onHidden, onVisible])

  return isPageVisible
}

// Hook for managing animation frames that automatically pause when page is hidden
export function useAnimationFrameWithVisibility() {
  const rafRef = useRef<number | null>(null)
  const [isPageVisible, setIsPageVisible] = useState(true)

  const cancelRAF = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const requestRAF = useCallback((callback: FrameRequestCallback) => {
    cancelRAF()
    rafRef.current = requestAnimationFrame(callback)
    return rafRef.current
  }, [cancelRAF])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden
      setIsPageVisible(!hidden)

      if (hidden) {
        cancelRAF()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelRAF()
    }
  }, [cancelRAF])

  return { isPageVisible, rafRef, requestRAF, cancelRAF }
}

