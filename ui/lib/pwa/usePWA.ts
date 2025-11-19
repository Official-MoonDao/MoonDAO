import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { isPWAMode } from './detectPWA'

interface UsePWAReturn {
  isPWA: boolean
  isAppLoading: boolean
}

export function usePWA(): UsePWAReturn {
  const router = useRouter()
  const [isPWA, setIsPWA] = useState(false)
  const [isAppLoading, setIsAppLoading] = useState(false)

  // Detect PWA mode on client side
  useEffect(() => {
    let hasSetLoading = false

    const checkPWAMode = () => {
      const isRunningStandalone = isPWAMode()
      const hasSourcePWA = window.location.search.includes('source=pwa')
      const isPWAStored = localStorage.getItem('isPWA') === 'true'

      // If launched with ?source=pwa, mark it in localStorage for future navigation
      if (hasSourcePWA) {
        localStorage.setItem('isPWA', 'true')
      }

      // Store in localStorage if detected as PWA for future sessions
      // Clear it if NOT in standalone mode (user went back to browser)
      if (isRunningStandalone) {
        localStorage.setItem('isPWA', 'true')
      } else if (isPWAStored) {
        localStorage.removeItem('isPWA')
      }

      setIsPWA(isRunningStandalone)

      // Only set loading state once on initial check
      if (!hasSetLoading) {
        setIsAppLoading(isRunningStandalone)
        hasSetLoading = true
      }
    }

    // Initial check
    checkPWAMode()

    // Listen for display mode changes (fixes first-launch detection issue)
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      checkPWAMode()
    }

    standaloneMediaQuery.addEventListener('change', handleDisplayModeChange)

    // Also recheck after a short delay to catch late-switching to standalone mode
    const delayedCheck = setTimeout(() => {
      checkPWAMode()
    }, 500)

    return () => {
      standaloneMediaQuery.removeEventListener('change', handleDisplayModeChange)
      clearTimeout(delayedCheck)
    }
  }, [])

  // Separate effect for PWA loading logic - only runs once when isPWA becomes true
  useEffect(() => {
    // Only run loading logic for PWA
    if (!isPWA) return

    let hasHidden = false
    const timeouts: NodeJS.Timeout[] = []

    const hideLoading = () => {
      if (!hasHidden) {
        hasHidden = true
        setIsAppLoading(false)
      }
    }

    // Failsafe: Force hide after 3 seconds maximum
    const maxTimeout = setTimeout(() => {
      hideLoading()
    }, 3000)
    timeouts.push(maxTimeout)

    const startTime = Date.now()

    // Check if app is ready
    const checkReady = () => {
      const isRouterReady = router.isReady
      const isDocumentReady = document.readyState === 'complete'

      if (isRouterReady && isDocumentReady) {
        // Wait minimum 1s for smooth transition, then hide
        const elapsed = Date.now() - startTime
        const remainingTime = Math.max(0, 1000 - elapsed)

        const hideTimeout = setTimeout(() => {
          hideLoading()
        }, remainingTime)
        timeouts.push(hideTimeout)
      } else if (!hasHidden) {
        const checkTimeout = setTimeout(checkReady, 100)
        timeouts.push(checkTimeout)
      }
    }

    checkReady()

    return () => {
      timeouts.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPWA])

  return { isPWA, isAppLoading }
}
