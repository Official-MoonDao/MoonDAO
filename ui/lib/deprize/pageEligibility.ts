import type { IncomingHttpHeaders } from 'http'
import type { GetServerSidePropsResult } from 'next'
import { getCountryFromHeaders, getRegionFromHeaders } from '@/lib/geo'
import { isNonProdBypassEnabled } from './eligibility'
import { isRestrictedJurisdiction, normalizeCountry } from './restrictedJurisdictions'

export type DePrizePageEligibility = {
  restricted: boolean
  country: string | null
}

export type DePrizePageProps = {
  restricted: boolean
}

type HeaderRequest = { headers: IncomingHttpHeaders }

/** Browser + Vercel CDN must not cache a country-specific DePrize page. */
export const DEPRIZE_PAGE_CACHE_CONTROL = 'private, no-store'

export function setDePrizePageNoStoreHeaders(res: {
  setHeader: (name: string, value: string) => void
}): void {
  res.setHeader('Cache-Control', DEPRIZE_PAGE_CACHE_CONTROL)
  // Cache-Control alone is not enough on Vercel — a public CDN HIT can leak
  // the allowed market UI to a restricted visitor (same lesson as gated missions).
  res.setHeader('CDN-Cache-Control', DEPRIZE_PAGE_CACHE_CONTROL)
  res.setHeader('Vercel-CDN-Cache-Control', DEPRIZE_PAGE_CACHE_CONTROL)
}

/**
 * Synchronous country/region gate for DePrize HTML pages.
 * Unknown country and listed jurisdictions are restricted. Does not call VPN
 * or sanctions providers — those still run before acceptance and permits.
 */
export function getDePrizePageEligibility(req: HeaderRequest): DePrizePageEligibility {
  const country = normalizeCountry(
    getCountryFromHeaders(req as Parameters<typeof getCountryFromHeaders>[0])
  )
  const region = getRegionFromHeaders(
    req as Parameters<typeof getRegionFromHeaders>[0]
  )

  if (isNonProdBypassEnabled()) {
    return { restricted: false, country }
  }
  if (!country) {
    return { restricted: true, country: null }
  }
  if (isRestrictedJurisdiction(country, region)) {
    return { restricted: true, country }
  }
  return { restricted: false, country }
}

export function resolveDePrizePageProps(
  req: HeaderRequest,
  res: { setHeader: (name: string, value: string) => void }
): GetServerSidePropsResult<DePrizePageProps> {
  setDePrizePageNoStoreHeaders(res)
  return { props: { restricted: getDePrizePageEligibility(req).restricted } }
}
