import { createHash } from 'crypto'

const ALLOWED = /[^A-Za-z0-9 ._\-]/g

export function sanitizeDisplayName(raw: string): string {
  return raw.replace(ALLOWED, '').trim().slice(0, 32)
}

export function forecastPseudonym(userId: string): string {
  const hex = createHash('sha256').update(userId).digest('hex').slice(0, 4)
  return `Forecaster ${hex}`
}

/** Opaque Tableland row key. Never the raw Privy id or a wallet. */
export function forecastTableHandle(userId: string): string {
  const pepper = process.env.FORECAST_ID_PEPPER || ''
  return createHash('sha256').update(`${userId}${pepper}`).digest('hex').slice(0, 16)
}

export function publicDisplayName(profile: {
  displayName?: string
  optIn?: boolean
} | null, userId: string): string {
  if (profile?.optIn && profile.displayName) {
    const cleaned = sanitizeDisplayName(profile.displayName)
    if (cleaned) return cleaned
  }
  return forecastPseudonym(userId)
}
