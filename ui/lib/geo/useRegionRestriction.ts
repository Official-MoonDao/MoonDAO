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
}

/**
 * Resolves whether the current visitor is in a GDPR-restricted (EU/EEA) region.
 *
 * The previous behavior fully blocked these visitors at the edge. We now let
 * them browse and only gate the flows that write personal data on chain
 * (citizen / team creation). Detection comes from Vercel/Cloudflare geo headers
 * via `/api/geo/country`; unknown geo is treated as unrestricted so we never
 * block legitimate non-EU users on missing data.
 */
export default function useRegionRestriction(): RegionRestriction {
  const { data, isLoading } = useSWR<GeoCountryResponse>(
    '/api/geo/country',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000 * 60 * 60, // geo is stable per session
      shouldRetryOnError: false,
    }
  )

  return {
    country: data?.country ?? null,
    isRestricted: Boolean(data?.restricted),
    isLoading: isLoading && data === undefined,
  }
}
