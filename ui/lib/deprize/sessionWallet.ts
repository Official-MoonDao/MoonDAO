import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAddress } from 'viem'
import { getPrivyUserData } from '@/lib/privy'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { isHexAddress } from './eligibility'

function accessTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
  return null
}

/** Pick a session wallet. A claimed address must belong to the session. */
export function selectSessionWallet(
  wallets: string[],
  claimedWallet?: string | null
): string | null {
  const owned = wallets.filter((addr) => isHexAddress(addr))
  if (owned.length === 0) return null

  const claimed = claimedWallet?.trim() || ''
  if (claimed) {
    if (!isHexAddress(claimed)) return null
    const match = owned.find((w) => w.toLowerCase() === claimed.toLowerCase())
    return match ? getAddress(match) : null
  }

  if (owned.length === 1) return getAddress(owned[0])
  return null
}

/**
 * Wallet the caller is allowed to act as: an address from the verified Privy
 * session, optionally selected by `claimedWallet` when the user has several.
 */
export async function walletFromSession(
  req: NextApiRequest,
  res: NextApiResponse,
  claimedWallet?: string | null
): Promise<string | null> {
  let accessToken = accessTokenFromRequest(req)
  if (!accessToken) {
    const session = await getServerSession(req, res, authOptions)
    accessToken = session?.accessToken || null
  }
  if (!accessToken) return null

  const privyUserData = await getPrivyUserData(accessToken)
  if (!privyUserData) return null

  return selectSessionWallet(privyUserData.walletAddresses, claimedWallet)
}
