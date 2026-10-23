import useSWR from 'swr'
import { isNonProdBypassEnabled } from '@/lib/deprize/eligibility'
import { isSepoliaPreviewPath } from '@/lib/deprize/pageEligibility'
import { isRestrictedJurisdiction, normalizeCountry } from '@/lib/deprize/restrictedJurisdictions'
import fetcher from '@/lib/swr/fetcher'

type GeoCountryResponse = {
  country: string | null
}

/**
 * Schedule A for a client surface that is not a DePrize page.
 * Unknown country is restricted once the lookup finishes, matching
 * getDePrizePageEligibility. `/api/geo/country` has no region subdivision,
 * so occupied-region checks that need that header are not applied here.
 */
export function useClientDePrizeRestricted(): boolean {
  const { data, error, isLoading } = useSWR<GeoCountryResponse>('/api/geo/country', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 60,
    errorRetryCount: 3,
  })

  if (isNonProdBypassEnabled()) return false
  if (typeof window !== 'undefined' && isSepoliaPreviewPath(window.location.pathname)) {
    return false
  }
  if (isLoading && data === undefined && !error) return false
  const country = normalizeCountry(data?.country)
  if (!country) return true
  return isRestrictedJurisdiction(country)
}
