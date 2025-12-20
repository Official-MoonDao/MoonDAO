import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'

export function useOnrampInitialStage(
  address: string | undefined,
  restoreCache: (addressOverride?: string) => any | null,
  defaultStage: number = 0,
  finalStage: number = 2,
  getAddressFromJWT?: () => string | null
): number {
  const router = useRouter()
  const [stage, setStage] = useState(defaultStage)
  const hasRestored = useRef(false)

  useEffect(() => {
    if (hasRestored.current) {
      return
    }

    if (!router.isReady) {
      return
    }

    if (router.query.onrampSuccess !== 'true') {
      hasRestored.current = true
      return
    }

    const jwtAddress = getAddressFromJWT ? getAddressFromJWT() : null
    const addressToUse = jwtAddress || address

    if (!addressToUse) {
      return
    }

    const cached = restoreCache(jwtAddress || undefined)

    if (cached?.stage !== undefined) {
      setStage(cached.stage)
      hasRestored.current = true
      return
    }

    if (cached?.formData) {
      setStage(finalStage)
      hasRestored.current = true
      return
    }

    hasRestored.current = true
  }, [router.isReady, router.query.onrampSuccess, address, restoreCache, finalStage, defaultStage])

  return stage
}
