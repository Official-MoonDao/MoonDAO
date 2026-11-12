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
  return (await sessionWallet(req, res, claimedWallet))?.wallet ?? null
}

/** Like `walletFromSession`, but also admits Privy guests and says which it is. */
export async function sessionWallet(
  req: NextApiRequest,
  res: NextApiResponse,
  claimedWallet?: string | null,
  options: { allowGuest?: boolean } = {}
): Promise<{ wallet: string; isGuest: boolean } | null> {
  let accessToken = accessTokenFromRequest(req)
  if (!accessToken) {
    const session = await getServerSession(req, res, authOptions)
    accessToken = session?.accessToken || null
  }
  if (!accessToken) return null

  const privyUserData = await getPrivyUserData(accessToken, options)
  if (!privyUserData) return null

  const wallet = selectSessionWallet(privyUserData.walletAddresses, claimedWallet)
  return wallet ? { wallet, isGuest: privyUserData.isGuest } : null
}
