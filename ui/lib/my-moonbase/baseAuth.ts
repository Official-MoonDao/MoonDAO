/**
 * Which wallet a save request may act as.
 *
 * The builder saves every few seconds while someone is building, and asking
 * Privy for the user record on each of those would be a request to Privy per
 * save. The token is verified on every request; the wallets linked to that
 * user are remembered for a few minutes.
 *
 * Server only.
 */
import type { Redis } from '@upstash/redis'
import type { NextApiRequest } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

const WALLETS_TTL_SECONDS = 300
const WALLET_RE = /^0x[0-9a-f]{40}$/

const remembered = new Map<string, { wallets: string[]; until: number }>()

function walletsKey(userId: string): string {
  return `moonbase:base:wallets:${userId}`
}

function bearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

async function rememberedWallets(userId: string, redis: Redis): Promise<string[] | null> {
  const hit = remembered.get(userId)
  if (hit && hit.until > Date.now()) return hit.wallets
  const cached = await redis.get<unknown>(walletsKey(userId)).catch(() => null)
  if (!Array.isArray(cached) || !cached.every((wallet) => typeof wallet === 'string')) return null
  remembered.set(userId, { wallets: cached, until: Date.now() + WALLETS_TTL_SECONDS * 1000 })
  return cached
}

async function fetchWallets(token: string, userId: string, redis: Redis): Promise<string[] | null> {
  // Guests build too: a base is made of free predictions, which a guest can save.
  const user = await getPrivyUserData(token, { allowGuest: true })
  if (!user) return null
  const wallets = user.walletAddresses.map((wallet) => wallet.toLowerCase())
  remembered.set(userId, { wallets, until: Date.now() + WALLETS_TTL_SECONDS * 1000 })
  await redis
    .set(walletsKey(userId), JSON.stringify(wallets), { ex: WALLETS_TTL_SECONDS })
    .catch(() => {})
  return wallets
}

/**
 * The claimed wallet, lower case, when it belongs to the signed-in caller.
 * Null for a missing or invalid session, or a wallet that is not theirs.
 */
export async function baseCallerWallet(
  req: NextApiRequest,
  redis: Redis,
  claimedWallet: unknown
): Promise<string | null> {
  const wanted = typeof claimedWallet === 'string' ? claimedWallet.trim().toLowerCase() : ''
  if (!WALLET_RE.test(wanted)) return null
  const token = bearerToken(req)
  if (!token) return null
  const claims = await verifyPrivyAuth(token, { allowGuest: true })
  if (!claims) return null

  const known = await rememberedWallets(claims.userId, redis)
  if (known?.includes(wanted)) return wanted
  // Not remembered yet, or a wallet linked since the list was.
  const current = await fetchWallets(token, claims.userId, redis)
  return current?.includes(wanted) ? wanted : null
}
