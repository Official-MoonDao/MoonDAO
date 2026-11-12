import { Redis } from '@upstash/redis'

/**
 * Privy guest accounts carry a valid access token but no login. The token
 * claims do not say "guest", so the user record decides. A guest can only
 * upgrade to a full user, never the reverse, so a full answer is cached for
 * good and a guest answer only briefly.
 */

const GUEST_TTL_MS = 30_000
const FULL_REDIS_KEY = (userId: string) => `privy:full-user:${userId}`

const fullUsers = new Set<string>()
const guestUntil = new Map<string, number>()

let redis: Redis | null = null
function redisClient(): Redis | null {
  if (redis) return redis
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) return null
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  })
  return redis
}

/** `is_guest` on the Privy REST user record. */
export function isGuestRecord(record: unknown): boolean {
  return !!record && typeof record === 'object' && (record as any).is_guest === true
}

export async function fetchPrivyUserRecord(userId: string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`https://auth.privy.io/api/v1/users/${userId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.NEXT_PUBLIC_PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`
        ).toString('base64')}`,
        'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Privy user lookup failed: ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export function rememberPrivyUser(userId: string, guest: boolean) {
  if (guest) {
    guestUntil.set(userId, Date.now() + GUEST_TTL_MS)
    return
  }
  guestUntil.delete(userId)
  if (fullUsers.has(userId)) return
  fullUsers.add(userId)
  void redisClient()
    ?.set(FULL_REDIS_KEY(userId), 1)
    .catch(() => {})
}

/** Throws when the lookup fails, so callers fail closed. */
export async function isPrivyGuest(userId: string): Promise<boolean> {
  if (fullUsers.has(userId)) return false
  const until = guestUntil.get(userId)
  if (until && until > Date.now()) return true

  try {
    const cached = await redisClient()?.get(FULL_REDIS_KEY(userId))
    if (cached) {
      fullUsers.add(userId)
      return false
    }
  } catch {
    // Fall through to Privy.
  }

  const guest = isGuestRecord(await fetchPrivyUserRecord(userId))
  rememberPrivyUser(userId, guest)
  return guest
}
