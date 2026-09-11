/**
 * ISO 3166-1 alpha-2 codes for DePrize Terms Schedule A.
 * Keep in lockstep with the published Restricted Jurisdictions schedule.
 */

export const US_AND_TERRITORIES: ReadonlySet<string> = new Set([
  'US',
  'PR', // Puerto Rico
  'GU', // Guam
  'VI', // U.S. Virgin Islands
  'AS', // American Samoa
  'MP', // Northern Mariana Islands
  'UM', // U.S. Minor Outlying Islands
])

/** Comprehensively sanctioned jurisdictions (Schedule A.B), country-level. */
export const COMPREHENSIVE_SANCTIONS: ReadonlySet<string> = new Set([
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'SY', // Syria
])

/**
 * Occupied regions of Ukraine (Schedule A.B). Matched against Vercel
 * `x-vercel-ip-country-region` / Cloudflare `cf-region-code` when the country
 * is UA (or RU, which some edges emit for Crimea).
 */
export const UKRAINE_OCCUPIED_REGIONS: ReadonlySet<string> = new Set([
  '43', // Crimea
  '14', // Donetsk
  '09', // Luhansk
  '65', // Kherson
  '23', // Zaporizhzhia
  'UA-43',
  'UA-14',
  'UA-09',
  'UA-65',
  'UA-23',
  'CRIMEA',
  'DONETSK',
  'LUHANSK',
  'KHERSON',
  'ZAPORIZHZHIA',
  'ZAPORIZHIA',
])

export const ELEVATED_SANCTIONS_RISK: ReadonlySet<string> = new Set([
  'RU', // Russia
  'BY', // Belarus
  'AF', // Afghanistan
  'MM', // Myanmar
  'VE', // Venezuela
  'YE', // Yemen
  'LY', // Libya
  'SO', // Somalia
  'SS', // South Sudan
  'SD', // Sudan
  'CD', // DRC
  'CF', // Central African Republic
  'ML', // Mali
  'IQ', // Iraq
  'LB', // Lebanon
  'NI', // Nicaragua
  'ZW', // Zimbabwe
])

/** Regulators treat prediction markets as licensed betting / derivatives. */
export const PREDICTION_MARKET_RESTRICTED: ReadonlySet<string> = new Set([
  'GB',
  'IE',
  'AU',
  'NZ',
  'SG',
  'CA',
  'FR',
  'ES',
  'PT',
  'IT',
  'DE',
  'NL',
  'BE',
  'PL',
  'CZ',
])

export const GDPR_REGIONS: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'GI',
  'JE',
  'GG',
  'IM',
])

export const LOCAL_LICENCE_REQUIRED: ReadonlySet<string> = new Set([
  'CN',
  'HK',
  'MO',
  'JP',
  'KR',
  'TW',
  'IN',
  'PK',
  'BD',
  'ID',
  'MY',
  'TH',
  'VN',
  'PH',
  'TR',
  'AE',
  'SA',
  'QA',
  'KW',
  'BR',
])

const ALL_RESTRICTED: ReadonlySet<string> = new Set([
  ...US_AND_TERRITORIES,
  ...COMPREHENSIVE_SANCTIONS,
  ...ELEVATED_SANCTIONS_RISK,
  ...PREDICTION_MARKET_RESTRICTED,
  ...GDPR_REGIONS,
  ...LOCAL_LICENCE_REQUIRED,
])

export function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null
  const upper = code.trim().toUpperCase()
  if (!upper || upper === 'XX' || upper === 'T1') return null
  return upper
}

export function normalizeRegion(code: string | null | undefined): string | null {
  if (!code) return null
  return code.trim().toUpperCase()
}

export function isRestrictedJurisdiction(
  countryCode: string | null | undefined,
  regionCode?: string | null
): boolean {
  const country = normalizeCountry(countryCode)
  if (!country) return false
  if (ALL_RESTRICTED.has(country)) return true
  if (country === 'UA' || country === 'RU') {
    const region = normalizeRegion(regionCode)
    if (region && UKRAINE_OCCUPIED_REGIONS.has(region)) return true
  }
  return false
}
