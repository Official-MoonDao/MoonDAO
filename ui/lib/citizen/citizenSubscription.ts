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

const expiryCacheKey = (tokenId: string) => `${EXPIRY_CACHE_PREFIX}${tokenId}`

/**
 * Only unexpired timestamps are ever cached, and an entry is dropped once its
 * timestamp passes. A renewal therefore can't be masked by a stale "expired"
 * verdict, and the common case (valid citizen) still avoids the RPC.
 */
export function getCachedCitizenExpiry(tokenId: string): number | undefined {
  if (typeof window === 'undefined' || !tokenId) return undefined

  try {
    const cached = localStorage.getItem(expiryCacheKey(tokenId))
    if (!cached) return undefined

    const parsed: CachedExpiry = JSON.parse(cached)
    if (typeof parsed?.data !== 'number') return undefined

    if (parsed.data * 1000 <= Date.now()) {
      localStorage.removeItem(expiryCacheKey(tokenId))
      return undefined
    }

    return parsed.data
  } catch (error) {
    console.warn('Failed to load cached citizen expiration:', error)
    return undefined
  }
}

export function setCachedCitizenExpiry(tokenId: string, expiresAt: number) {
  if (typeof window === 'undefined' || !tokenId) return
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return

  try {
    const entry: CachedExpiry = { data: expiresAt, timestamp: Date.now() }
    localStorage.setItem(expiryCacheKey(tokenId), JSON.stringify(entry))
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
  tokenId: string
): Promise<number | null> {
  if (!tokenId) return null

  const cached = getCachedCitizenExpiry(tokenId)
  if (cached !== undefined) return cached

  try {
    // Imported lazily so the pure helpers above stay usable without a
    // configured thirdweb client (they run in Node unit tests).
    const { default: client } = await import('../thirdweb/client')
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const contract = getContract({
      client,
      address: CITIZEN_ADDRESSES[chainSlug],
      chain: DEFAULT_CHAIN_V5,
      abi: CitizenABI as any,
    })

    const expiresAt: any = await readContract({
      contract,
      method: 'expiresAt' as string,
      params: [tokenId],
    })

    const seconds = Number(expiresAt?.toString())
    if (!Number.isFinite(seconds)) return null

    setCachedCitizenExpiry(tokenId, seconds)
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
