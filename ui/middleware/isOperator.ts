import { OPERATORS } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getPrivyUserData } from '@/lib/privy'
import { authOptions } from '../pages/api/auth/[...nextauth]'

// Simple allowlist gate for the operator panel. Accepts the request if any
// wallet linked to the authenticated Privy user is in `OPERATORS` (see
// `const/config.ts`). On testnet we bypass auth entirely so local dev still
// works.
export async function isOperator(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  if (process.env.NEXT_PUBLIC_CHAIN === 'testnet') {
    next()
    return
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.accessToken) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const privyUserData = await getPrivyUserData(session.accessToken)
  if (!privyUserData || privyUserData.walletAddresses.length === 0) {
    res.status(401).json({ error: 'No wallet addresses found' })
    return
  }

  const allow = new Set(OPERATORS.map((a) => a.toLowerCase()))
  const wallets = privyUserData.walletAddresses.map((a) => a.toLowerCase())

  if (wallets.some((w) => allow.has(w))) {
    next()
    return
  }

  console.warn('[isOperator] denied', { wallets })
  res.status(403).json({
    error: 'Forbidden: operator access required',
    walletsChecked: wallets,
  })
}
