import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'

export function useOnrampInitialStage(
  address: string | undefined,
  restoreCache: () => any | null,
  defaultStage: number = 0,
  finalStage: number = 2
): number {
  const router = useRouter()
  const [stage, setStage] = useState(defaultStage)
  const hasRestored = useRef(false)
  
  useEffect(() => {
    // Only run once
    if (hasRestored.current) {
      return
    }
    
    // Wait for router to be ready
    if (!router.isReady) {
      return
    }
    
    // Only attempt restoration if returning from onramp
    if (router.query.onrampSuccess !== 'true') {
      hasRestored.current = true
      return
    }
    
    // CRITICAL: Wait for address to be available
    // Without address, the cache key is wrong and we can't restore
    if (!address) {
      return // Keep waiting for address
    }
    
    // Try to restore stage from cache
    const cached = restoreCache()
    if (cached?.stage !== undefined) {
      setStage(cached.stage)
      hasRestored.current = true
      return
    }
    
    // If cache exists but no stage, assume final stage
    if (cached?.formData) {
      setStage(finalStage)
      hasRestored.current = true
      return
    }
    
    hasRestored.current = true
  }, [router.isReady, router.query.onrampSuccess, address, restoreCache, finalStage])
  
  return stage
}

