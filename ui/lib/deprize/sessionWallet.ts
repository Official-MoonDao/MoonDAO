import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getPrivyUserData } from '@/lib/privy'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { selectSessionWallet } from './selectSessionWallet'

export { selectSessionWallet }

function accessTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
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
