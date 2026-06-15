import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'

type GeoCountryResponse = {
  country: string | null
  restricted?: boolean
}

export type RegionRestriction = {
  // The visitor's detected country code (ISO 3166-1 alpha-2), or null.
  country: string | null
  // True for EU/EEA visitors who may browse the site but cannot permanently
  // store personal data on chain (GDPR). Defaults to false until resolved.
  isRestricted: boolean
  // True while geo is still being resolved. Gate destructive UI on this so we
  // don't briefly flash a creation flow before discovering the user is in a
  // restricted region.
  isLoading: boolean
  // True when geo resolution failed after retries. Callers gating personal-data
  // creation flows should treat this as "unresolved" rather than "allowed".
  isError: boolean
}

/**
 * Resolves whether the current visitor is in a GDPR-restricted (EU/EEA/UK)
 * region.
 *
 * The previous behavior fully blocked these visitors at the edge. We now let
 * them browse and only gate the flows that write personal data on chain
 * (citizen / team creation). Detection comes from Vercel/Cloudflare geo headers
 * via `/api/geo/country`.
 *
 * This client hook is only a UX gate; it retries on error (rather than silently
 * failing open after one failed fetch) and surfaces `isError` so creation pages
 * can avoid rendering the wizard on an unresolved region. The authoritative
 * GDPR block is enforced server-side in the data-persistence routes (see
 * `enforceRegionNotRestricted`), which return HTTP 451 regardless of the client.
 */
export default function useRegionRestriction(): RegionRestriction {
  const { data, error, isLoading } = useSWR<GeoCountryResponse>(
    '/api/geo/country',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000 * 60 * 60, // geo is stable per session
      errorRetryCount: 3,
    }
  )

  return {
    country: data?.country ?? null,
    isRestricted: Boolean(data?.restricted),
    isLoading: isLoading && data === undefined && !error,
    isError: Boolean(error) && data === undefined,
  }
}
