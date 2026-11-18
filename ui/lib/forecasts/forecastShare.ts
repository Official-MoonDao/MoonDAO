/**
 * Share link and prefilled post for a free forecast.
 *
 * The URL is the public page the visitor forecast on, always on
 * www.moondao.com. Query, hash, wallet addresses, and the pick itself stay
 * off the link. The post names the forecast they are sharing.
 */

export const FORECAST_SHARE_ORIGIN = 'https://www.moondao.com'

/** Used when the saved competitor has no public name yet. */
export const FORECAST_SHARE_TEXT = 'My forecast on MoonDAO.'

/** X counts every attached URL as 23 characters, plus the space before it. */
export const X_URL_WEIGHT = 23
export const X_POST_LIMIT = 280

const GENERIC_PICK = /^(this competitor|team #\d+)$/i

function sharePickName(pick?: string | null): string | null {
  if (pick == null) return null
  const name = String(pick).replace(/\s+/g, ' ').trim()
  if (!name || GENERIC_PICK.test(name)) return null
  if (/0x[a-fA-F0-9]{40}/i.test(name) || name.includes('@')) return null
  return name
}

/** Prefilled post. Names the pick when we have one. No availability or jurisdiction line. */
export function forecastShareText(pick?: string | null): string {
  const name = sharePickName(pick)
  if (!name) return FORECAST_SHARE_TEXT
  const prefix = 'My forecast: '
  const suffix = '.'
  const budget = X_POST_LIMIT - 1 - X_URL_WEIGHT - prefix.length - suffix.length
  let shown = name
  if (shown.length > budget) {
    const cut = shown.slice(0, Math.max(1, budget - 1))
    const space = cut.lastIndexOf(' ')
    shown = `${(space > 8 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`
  }
  return `${prefix}${shown}${suffix}`
}

export type ForecastShareMethod = 'x' | 'copy'

const WALLET_SEGMENT = /^0x[a-fA-F0-9]{40}$/i
const TX_SEGMENT = /^0x[a-fA-F0-9]{64}$/i
const ADDRESS_IN_SEGMENT = /0x[a-fA-F0-9]{40}/i

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/**
 * Pathname only. Drops a query, a hash, and any segment that is an address
 * or a transaction hash. Null when the input is not a site path.
 */
export function canonicalForecastPath(input: string | null | undefined): string | null {
  if (input == null) return null
  let raw = String(input).trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('mailto:') || raw.startsWith('#')) {
    return null
  }
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
      const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
      raw = url.pathname
    }
  } catch {
    return null
  }
  const pathOnly = raw.split('#')[0].split('?')[0]
  if (!pathOnly.startsWith('/') || pathOnly.includes('\\') || pathOnly.includes('@')) return null
  const segments: string[] = []
  let droppedIdentity = false
  for (const segment of pathOnly.split('/')) {
    if (!segment) continue
    const decoded = decodeSegment(segment)
    if (decoded == null) return null
    if (
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('@') ||
      decoded === '.' ||
      decoded === '..'
    ) {
      return null
    }
    if (
      WALLET_SEGMENT.test(decoded) ||
      TX_SEGMENT.test(decoded) ||
      ADDRESS_IN_SEGMENT.test(decoded)
    ) {
      droppedIdentity = true
      continue
    }
    segments.push(encodeURIComponent(decoded))
  }
  if (segments.length === 0) return droppedIdentity ? null : '/'
  return `/${segments.join('/')}`
}

export function forecastShareUrl(
  input: string | null | undefined,
  method: ForecastShareMethod
): string {
  const path = canonicalForecastPath(input) ?? '/deprize'
  const source = method === 'copy' ? 'copy' : 'x'
  return `${FORECAST_SHARE_ORIGIN}${path}?utm_source=${source}&utm_medium=social&utm_campaign=forecast_share`
}

/** Composed X post length. The attached page URL counts as 23, not its full length. */
export function forecastXPostLength(text: string = FORECAST_SHARE_TEXT): number {
  const separator = text.length > 0 ? 1 : 0
  return text.length + separator + X_URL_WEIGHT
}

export function forecastXIntentUrl(input: string | null | undefined, pick?: string | null): string {
  const url = forecastShareUrl(input, 'x')
  return `https://x.com/intent/post?text=${encodeURIComponent(
    forecastShareText(pick)
  )}&url=${encodeURIComponent(url)}`
}
