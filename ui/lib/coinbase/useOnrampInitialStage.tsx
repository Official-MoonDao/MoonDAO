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
    console.log('[useOnrampInitialStage] Effect triggered:', {
      hasRestored: hasRestored.current,
      routerReady: router.isReady,
      onrampSuccess: router.query.onrampSuccess,
      address: address?.substring(0, 10) + '...'
    })
    
    if (hasRestored.current) {
      return
    }

    if (!router.isReady) {
      return
    }

    // Only attempt restoration if returning from onramp
    if (router.query.onrampSuccess !== 'true') {
      console.log('[useOnrampInitialStage] Not returning from onramp, using defaultStage:', defaultStage)
      hasRestored.current = true
      return
    }

    if (!address) {
      console.log('[useOnrampInitialStage] No address, waiting...')
      return
    }

    console.log('[useOnrampInitialStage] Calling restoreCache()')
    const cached = restoreCache()
    console.log('[useOnrampInitialStage] Cache result:', {
      hasCached: !!cached,
      stage: cached?.stage,
      hasFormData: !!cached?.formData
    })

    if (cached?.stage !== undefined) {
      console.log('[useOnrampInitialStage] Setting stage from cache:', cached.stage)
      setStage(cached.stage)
      hasRestored.current = true
      return
    }

    // If cache exists but no stage, assume final stage
    if (cached?.formData) {
      console.log('[useOnrampInitialStage] Cache has formData but no stage, using finalStage:', finalStage)
      setStage(finalStage)
      hasRestored.current = true
      return
    }
    
    console.log('[useOnrampInitialStage] No cache found, marking as restored')
    hasRestored.current = true
  }, [router.isReady, router.query.onrampSuccess, address, restoreCache, finalStage, defaultStage])

  return stage
}
