import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getChainSlug } from '../thirdweb/chain'

// Citizenship is a subscription NFT: `expiresAt(tokenId)` returns the unix
// second at which it lapses. Once lapsed the wallet keeps the token but loses
// every citizen-gated feature until it renews.

// Shares the `moondao_citizen_` prefix with CitizenProvider's cache so logout
// and the periodic sweep clear these entries too.
const EXPIRY_CACHE_PREFIX = 'moondao_citizen_expiry_'

type CachedExpiry = {
  data: number
  timestamp: number
}

const expiryCacheKey = (tokenId: string, chainId?: number) =>
  chainId == null
    ? `${EXPIRY_CACHE_PREFIX}${tokenId}`
    : `${EXPIRY_CACHE_PREFIX}${chainId}_${tokenId}`

function readCachedCitizenExpiry(tokenId: string, chainId?: number): number | undefined {
  if (typeof window === 'undefined' || !tokenId) return undefined

  try {
    const key = expiryCacheKey(tokenId, chainId)
    const cached = localStorage.getItem(key)
    if (!cached) return undefined

    const parsed: CachedExpiry = JSON.parse(cached)
    if (typeof parsed?.data !== 'number') return undefined

    if (parsed.data * 1000 <= Date.now()) {
      localStorage.removeItem(key)
      return undefined
    }

    return parsed.data
  } catch (error) {
    console.warn('Failed to load cached citizen expiration:', error)
    return undefined
  }
}

/**
 * Only unexpired timestamps are ever cached, and an entry is dropped once its
 * timestamp passes. A renewal therefore can't be masked by a stale "expired"
 * verdict, and the common case (valid citizen) still avoids the RPC.
 *
 * `fetchCitizenExpiresAt` always stores the chain it read. A lookup that omits
 * `chainId` still has to see that default-chain entry (and the legacy unscoped
 * key) or a returning citizen is treated as unchecked.
 */
export function getCachedCitizenExpiry(tokenId: string, chainId?: number): number | undefined {
  if (chainId != null) return readCachedCitizenExpiry(tokenId, chainId)

  return readCachedCitizenExpiry(tokenId, DEFAULT_CHAIN_V5.id) ?? readCachedCitizenExpiry(tokenId)
}

export function setCachedCitizenExpiry(
  tokenId: string,
  expiresAt: number,
  chainId?: number
) {
  if (typeof window === 'undefined' || !tokenId) return
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return

  try {
    const entry: CachedExpiry = { data: expiresAt, timestamp: Date.now() }
    localStorage.setItem(expiryCacheKey(tokenId, chainId), JSON.stringify(entry))
  } catch (error) {
    console.warn('Failed to cache citizen expiration:', error)
  }
}

/**
 * Reads `expiresAt` for a citizen token. Returns `null` when the read fails so
 * callers can fail open — an RPC blip must never lock a paid-up citizen out of
 * the app (same reasoning as CitizenProvider's Tableland error handling).
 */
export async function fetchCitizenExpiresAt(
  tokenId: string,
  chain: { id: number; name?: string } = DEFAULT_CHAIN_V5
): Promise<number | null> {
  if (!tokenId) return null

  const cached = getCachedCitizenExpiry(tokenId, chain.id)
  if (cached !== undefined) return cached

  try {
    // Imported lazily so the pure helpers above stay usable without a
    // configured thirdweb client (they run in Node unit tests).
    const { default: client } = await import('../thirdweb/client')
    const chainSlug = getChainSlug(chain as any)
    const address = CITIZEN_ADDRESSES[chainSlug]
    if (!address) return null
    const contract = getContract({
      client,
      address,
      chain: chain as any,
      abi: CitizenABI as any,
    })

    const expiresAt: any = await readContract({
      contract,
      method: 'expiresAt' as string,
      params: [tokenId],
    })

    const seconds = Number(expiresAt?.toString())
    if (!Number.isFinite(seconds)) return null

    setCachedCitizenExpiry(tokenId, seconds, chain.id)
    return seconds
  } catch (error) {
    console.warn('Failed to read citizen expiration:', error)
    return null
  }
}

export function isSubscriptionExpired(expiresAt?: number | null): boolean {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return false
  return expiresAt * 1000 <= Date.now()
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Show the dashboard Renew control as a red alert inside this window. */
export const CITIZENSHIP_RENEWAL_ALERT_DAYS = 30

/**
 * Whole days until `expiresAt`, rounded up so the last day still counts as 1.
 * Returns null when the timestamp is missing or unreadable.
 */
export function daysUntilCitizenshipExpiry(
  expiresAt?: number | null,
  nowMs = Date.now()
): number | null {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
  return Math.ceil((expiresAt * 1000 - nowMs) / MS_PER_DAY)
}

export function isCitizenshipRenewalUrgent(expiresAt?: number | null, nowMs = Date.now()): boolean {
  const days = daysUntilCitizenshipExpiry(expiresAt, nowMs)
  return days !== null && days <= CITIZENSHIP_RENEWAL_ALERT_DAYS
}

export function formatCitizenshipExpiryDate(expiresAt: number): string {
  return new Date(expiresAt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Date line next to the dashboard Renew button. Urgent copy includes days left. */
export function citizenshipRenewalLabel(expiresAt: number, nowMs = Date.now()): string {
  const date = formatCitizenshipExpiryDate(expiresAt)
  const days = daysUntilCitizenshipExpiry(expiresAt, nowMs)
  if (days === null || days > CITIZENSHIP_RENEWAL_ALERT_DAYS) return `Expires ${date}`
  if (days <= 0) return `Expires today · ${date}`
  if (days === 1) return `1 day left · ${date}`
  return `${days} days left · ${date}`
}

/**
 * Drop every cached expiration for a token. An early renewal extends a date
 * that is still in the future, so the "only cache unexpired timestamps" rule
 * would keep showing the old date until that old date passed.
 */
export function clearCachedCitizenExpiry(tokenId: string, chainId?: number) {
  if (typeof window === 'undefined' || !tokenId) return

  try {
    const keys = new Set<string>([
      expiryCacheKey(tokenId),
      expiryCacheKey(tokenId, DEFAULT_CHAIN_V5.id),
    ])
    if (chainId != null) keys.add(expiryCacheKey(tokenId, chainId))
    keys.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear cached citizen expiration:', error)
  }
}

/**
 * Routes whose whole purpose is a citizen-gated feature. Landing on one with a
 * lapsed subscription re-opens the renewal dialog even if it was dismissed.
 */
export const CITIZEN_GATED_ROUTES = [
  '/dashboard',
  '/quests',
  '/jobs',
  '/jobs/[id]',
  '/contributions',
]
