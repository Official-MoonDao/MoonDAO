import { useEffect, useState } from 'react'

export interface UseOnrampRegionReturn {
  /** ISO country code from request headers, or null while loading / unknown */
  country: string | null
  /** True when we've confirmed the user is in the US */
  isUS: boolean
  /** True until the region check completes (or fails) */
  isLoading: boolean
  /** True when the lookup failed; falls back to non-US legacy redirect flow */
  error: string | null
}

let cachedResult: { country: string | null; isUS: boolean } | null = null
let inflight: Promise<{ country: string | null; isUS: boolean }> | null = null

async function fetchRegion(): Promise<{ country: string | null; isUS: boolean }> {
  if (cachedResult) return cachedResult
  if (inflight) return inflight
  inflight = (async () => {
    const res = await fetch('/api/coinbase/region', {
      method: 'GET',
      credentials: 'include',
    })
    if (!res.ok) {
      throw new Error(`region lookup failed: ${res.status}`)
    }
    const data = await res.json()
    const result = {
      country: data?.country ?? null,
      isUS: !!data?.isUS,
    }
    cachedResult = result
    return result
  })().finally(() => {
    inflight = null
  })
  return inflight
}

/**
 * Detects whether the user is in the US, which determines whether they get the
 * new Headless Onramp (iframe + Apple Pay) or the legacy logged-in Coinbase
 * redirect flow. Defaults to non-US (legacy) on failure to avoid breaking
 * users outside the US.
 */
export function useOnrampRegion(): UseOnrampRegionReturn {
  const [country, setCountry] = useState<string | null>(cachedResult?.country ?? null)
  const [isUS, setIsUS] = useState<boolean>(cachedResult?.isUS ?? false)
  const [isLoading, setIsLoading] = useState<boolean>(!cachedResult)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (cachedResult) {
      setCountry(cachedResult.country)
      setIsUS(cachedResult.isUS)
      setIsLoading(false)
      return
    }
    fetchRegion()
      .then((result) => {
        if (cancelled) return
        setCountry(result.country)
        setIsUS(result.isUS)
        setIsLoading(false)
      })
      .catch((err: any) => {
        if (cancelled) return
        console.warn('[useOnrampRegion] failed, falling back to non-US flow', err)
        setError(err?.message || 'region lookup failed')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { country, isUS, isLoading, error }
}

export default useOnrampRegion

/**
 * Pure decision for which Coinbase onramp variant to render:
 *  - US users get the new in-page Headless Onramp (iframe + Apple Pay)
 *  - everyone else gets the legacy logged-in Coinbase redirect flow
 *  - the `NEXT_PUBLIC_FORCE_LEGACY_ONRAMP` kill-switch forces legacy for all
 *
 * Extracted so the identical branch used by both `CBOnrampModal` and
 * `MissionContributeModal` can be unit tested without rendering React.
 */
export function shouldUseHeadlessOnramp(
  isUS: boolean,
  forceLegacy: boolean = process.env.NEXT_PUBLIC_FORCE_LEGACY_ONRAMP === 'true'
): boolean {
  if (forceLegacy) return false
  return !!isUS
}

