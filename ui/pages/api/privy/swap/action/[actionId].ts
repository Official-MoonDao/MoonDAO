import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  getWalletActionStatus,
  PrivySwapError,
  resolveWalletId,
} from '@/lib/privy/swaps'

function getAccessTokenFromReq(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  return null
}

function isValidEvmAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { actionId, address } = req.query

    if (typeof actionId !== 'string' || actionId.length === 0) {
      return res.status(400).json({ error: 'A swap action ID is required.' })
    }
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'A valid wallet address is required.' })
    }

    // --- Auth + wallet ownership ---
    const accessToken = getAccessTokenFromReq(req)
    if (!accessToken) {
      return res.status(401).json({ error: 'You must be signed in to check a swap.' })
    }
    const userData = await getPrivyUserData(accessToken)
    if (!userData) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
    const ownsWallet = userData.walletAddresses
      .map((a) => a.toLowerCase())
      .includes((address as string).toLowerCase())
    if (!ownsWallet) {
      return res.status(403).json({ error: 'This wallet does not belong to your account.' })
    }

    // Resolve the wallet ID server-side from the verified address rather than
    // trusting a client-supplied wallet ID.
    const walletId = await resolveWalletId(userData.userData, address as string)

    const action = await getWalletActionStatus({ walletId, actionId })

    return res.status(200).json({
      success: true,
      actionId: action.actionId,
      status: action.status,
      failureReason: action.failureReason,
    })
  } catch (err: any) {
    if (err instanceof PrivySwapError) {
      return res.status(err.status).json({ error: err.userMessage })
    }
    console.error('[api/privy/swap/action] unexpected error')
    return res.status(500).json({ error: 'Could not fetch swap status. Please try again.' })
  }
}

export default withMiddleware(handler, rateLimit)
