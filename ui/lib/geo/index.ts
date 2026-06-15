import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'

// Extract client IP from trusted headers
export function getClientIp(req: NextApiRequest): string {
  const h = req.headers
  const vercel = (h['x-vercel-proxied-for'] as string | undefined)?.trim()
  const real = (h['x-real-ip'] as string | undefined)?.trim()
  const cf = (h['cf-connecting-ip'] as string | undefined)?.trim()

  let ip =
    vercel ||
    real ||
    cf ||
    ((h['x-forwarded-for'] as string | undefined)?.split(',')[0] || '').trim() ||
    req.socket.remoteAddress ||
    '0.0.0.0'

  // Normalize IP - strip port and handle IPv6-mapped IPv4
  ip = ip.replace(/:\d+$/, '')
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return ip.toLowerCase()
}

// Extract country from request headers (Vercel/Cloudflare geolocation)
export function getCountryFromHeaders(req: NextApiRequest): string | null {
  const h = req.headers

  // Vercel provides x-vercel-ip-country
  const vercelCountry = (h['x-vercel-ip-country'] as string | undefined)?.trim()
  if (vercelCountry) {
    return vercelCountry.toUpperCase()
  }

  // Cloudflare provides cf-ipcountry
  const cfCountry = (h['cf-ipcountry'] as string | undefined)?.trim()
  if (cfCountry) {
    return cfCountry.toUpperCase()
  }

  return null
}

// GDPR-restricted regions (ISO 3166-1 alpha-2). Covers the EU, the wider EEA
// (Iceland, Liechtenstein, Norway), and the UK (which retains UK-GDPR
// post-Brexit). These regions cannot permanently store personal data on chain,
// so we let them browse the site but block on-chain profile creation.
export const EU_EEA_COUNTRIES: ReadonlySet<string> = new Set([
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czechia
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
  'IS', // Iceland (EEA)
  'LI', // Liechtenstein (EEA)
  'NO', // Norway (EEA)
  'GB', // United Kingdom (UK-GDPR)
  'GI', // Gibraltar (UK-GDPR)
  'JE', // Jersey (UK-GDPR adequacy)
  'GG', // Guernsey (UK-GDPR adequacy)
  'IM', // Isle of Man (UK-GDPR adequacy)
])

// Returns true when the country code belongs to a GDPR-restricted region
// (EU / EEA / UK). Unknown/null countries return false so we never block on
// missing geo data.
export function isEUCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false
  return EU_EEA_COUNTRIES.has(countryCode.toUpperCase())
}

// True when the request originates from a GDPR-restricted region, derived from
// trusted edge geo headers. Used by data-persistence API routes as a
// server-side companion to the client `useRegionRestriction` gate.
export function isRegionRestrictedRequest(req: NextApiRequest): boolean {
  return isEUCountry(getCountryFromHeaders(req))
}

// Defense-in-depth guard for routes that permanently store personal data
// (on-chain profile creation, profile image generation). The client UI already
// hides these flows from restricted regions, but that check is bypassable and
// can fail open, so the server independently rejects restricted regions with
// HTTP 451 (Unavailable For Legal Reasons). Returns true when the request may
// proceed; when it returns false it has already sent the 451 response.
export function enforceRegionNotRestricted(
  req: NextApiRequest,
  res: NextApiResponse
): boolean {
  if (isRegionRestrictedRequest(req)) {
    res.status(451).json({
      error:
        'On-chain profile creation is not available in your region for data-protection (GDPR) reasons. You can still browse the rest of the site.',
    })
    return false
  }
  return true
}

// Extract US state from request headers (Vercel/Cloudflare geolocation)
export function getStateFromHeaders(req: NextApiRequest): string | null {
  const h = req.headers

  // Vercel provides x-vercel-ip-country-region with US state codes
  const vercelRegion = (h['x-vercel-ip-country-region'] as string | undefined)?.trim()
  const vercelCountry = (h['x-vercel-ip-country'] as string | undefined)?.trim()

  if (vercelCountry === 'US' && vercelRegion) {
    // Vercel provides state codes like "IL", "CA", etc.
    return vercelRegion.toUpperCase()
  }

  // Cloudflare provides cf-region-code (state for US)
  const cfRegion = (h['cf-region-code'] as string | undefined)?.trim()
  const cfCountry = (h['cf-ipcountry'] as string | undefined)?.trim()

  if (cfCountry === 'US' && cfRegion) {
    return cfRegion.toUpperCase()
  }

  return null
}

// Check Redis cache for IP -> state mapping
export async function getStateFromCache(redis: Redis, ip: string): Promise<string | null> {
  try {
    const cached = await redis.get<string>(`geo:ip:${ip}`)
    return cached || null
  } catch (error) {
    console.error('Redis cache read error:', error)
    return null
  }
}

// Cache state in Redis with 48-hour TTL
export async function cacheState(redis: Redis, ip: string, state: string): Promise<void> {
  try {
    // Cache for 48 hours (172800 seconds)
    await redis.set(`geo:ip:${ip}`, state, { ex: 172800 })
  } catch (error) {
    console.error('Redis cache write error:', error)
  }
}

// Call free geolocation API to get state from IP
export async function getStateFromAPI(ip: string): Promise<string | null> {
  // Don't make API calls for private/local IPs
  if (
    ip === '0.0.0.0' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.')
  ) {
    return null
  }

  try {
    // Use ipapi.co - free tier: 1000 requests/day, no API key required
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'MoonDAO/1.0',
      },
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      console.error(`ipapi.co returned ${response.status} for IP ${ip}`)
      return null
    }

    const data = await response.json()

    // Check if it's a US location and has a region code
    if (data.country_code === 'US' && data.region_code) {
      return data.region_code.toUpperCase()
    }

    return null
  } catch (error: any) {
    console.error(`Failed to get state from API for IP ${ip}:`, error.message)
    return null
  }
}

// Main function: Detect user's US state
export async function detectUserState(req: NextApiRequest, redis: Redis): Promise<string | null> {
  // Strategy 1: Check request headers (fastest, free)
  const headerState = getStateFromHeaders(req)
  if (headerState) {
    console.log(`State detected from headers: ${headerState}`)
    return headerState
  }

  // Get client IP for further lookups
  const ip = getClientIp(req)

  // Strategy 2: Check Redis cache
  const cachedState = await getStateFromCache(redis, ip)
  if (cachedState) {
    console.log(`State retrieved from cache for IP ${ip}: ${cachedState}`)
    return cachedState
  }

  // Strategy 3: Call geolocation API
  const apiState = await getStateFromAPI(ip)
  if (apiState) {
    console.log(`State detected from API for IP ${ip}: ${apiState}`)
    // Cache for future requests
    await cacheState(redis, ip, apiState)
    return apiState
  }

  console.log(`Unable to detect state for IP ${ip}`)
  return null
}

// Validate that a state code is a valid US state
export function isValidUSState(stateCode: string | null): boolean {
  if (!stateCode) return false

  const validStates = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC',
  ]

  return validStates.includes(stateCode.toUpperCase())
}
