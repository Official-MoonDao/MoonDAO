// Edge providers use ISO 3166-1 alpha-2. XX (unknown) and T1 (Tor) are not countries.
// A duplicated header arrives as "US, US"; only the first token is the code.
export function normalizeGeoCountry(code: string | null | undefined): string | null {
  if (code == null) return null
  const token = String(code).split(',')[0].trim().toUpperCase()
  if (!token || token === 'XX' || token === 'T1') return null
  if (token === 'USA' || token === 'UNITED STATES') return 'US'
  if (!/^[A-Z]{2}$/.test(token)) return null
  return token
}

// Cookie opt-in is not required for the United States or its territories.
// Everywhere else with a real country code still has to choose. Unknown stays
// unknown so a failed lookup does not pop the banner.
const COOKIE_CONSENT_EXEMPT = new Set([
  'US',
  'PR', // Puerto Rico
  'GU', // Guam
  'VI', // U.S. Virgin Islands
  'AS', // American Samoa
  'MP', // Northern Mariana Islands
  'UM', // U.S. Minor Outlying Islands
])

export type CookieBannerDecision = 'grant' | 'prompt' | 'skip'

export function cookieBannerDecision(country: string | null | undefined): CookieBannerDecision {
  const code = normalizeGeoCountry(country)
  if (!code) return 'skip'
  if (COOKIE_CONSENT_EXEMPT.has(code)) return 'grant'
  return 'prompt'
}
