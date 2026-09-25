import { isNonProdBypassEnabled } from './eligibility'
import { isRestrictedJurisdiction, normalizeCountry } from './restrictedJurisdictions'

/**
 * Permitted country substituted for a local or US edge address while the
 * non-production bypass is on. Switzerland is on the allowed side of Schedule A.
 * Production never reads this.
 */
export const DEPRIZE_LOCAL_MOCK_COUNTRY = 'CH'

function permittedCountry(raw: string | null | undefined): string | null {
  const country = normalizeCountry(raw)
  if (!country || isRestrictedJurisdiction(country, null)) return null
  return country
}

/**
 * Country the DePrize gate should use.
 * Outside production, a missing or US address is treated as
 * `DEPRIZE_MOCK_COUNTRY`, the `x-deprize-mock-country` header, or Switzerland.
 * Production keeps the edge country, including US.
 */
export function countryForDePrize(input: {
  headerCountry: string | null
  mockHeader?: string | null
}): string | null {
  const headerCountry = normalizeCountry(input.headerCountry)
  if (!isNonProdBypassEnabled()) return headerCountry
  return (
    permittedCountry(input.mockHeader) ||
    permittedCountry(process.env.DEPRIZE_MOCK_COUNTRY) ||
    DEPRIZE_LOCAL_MOCK_COUNTRY
  )
}
