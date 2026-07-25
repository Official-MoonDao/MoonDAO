import crypto from 'crypto'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  arbitrumAsset,
  executeSwap,
  PrivySwapError,
  resolveWalletId,
} from '@/lib/privy/swaps'
import {
  DEFAULT_SLIPPAGE_BPS,
  humanAmountToBaseUnits,
  isSupportedSwapChainId,
  isValidSlippageBps,
  validateSwapPair,
} from '@/lib/privy/swapTokens'

function getAccessTokenFromReq(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  const bodyToken = (req.body as any)?.accessToken
  return typeof bodyToken === 'string' && bodyToken.length > 0 ? bodyToken : null
}

function isValidEvmAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      address,
      fromToken,
      toToken,
      amount,
      slippageBps,
      chainId,
      idempotencyKey,
    } = (req.body || {}) as Record<string, unknown>

    // --- Input validation (re-validated independently from the quote step) ---
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'A valid wallet address is required.' })
    }
    if (chainId !== undefined && !isSupportedSwapChainId(chainId as any)) {
      return res.status(400).json({ error: 'Swaps are currently supported on Arbitrum only.' })
    }
    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'Enter a valid amount.' })
    }

    const resolvedSlippage =
      slippageBps === undefined ? DEFAULT_SLIPPAGE_BPS : (slippageBps as number)
    if (!isValidSlippageBps(resolvedSlippage)) {
      return res.status(400).json({ error: 'Slippage must be between 0 and 10000 bps.' })
    }

    let pair
    try {
      pair = validateSwapPair(fromToken, toToken)
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Unsupported token pair.' })
    }

    let baseAmount: string
    try {
      baseAmount = humanAmountToBaseUnits(amount as string, pair.from.decimals).toString()
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Enter a valid amount.' })
    }

    // --- Auth + wallet ownership ---
    const accessToken = getAccessTokenFromReq(req)
    if (!accessToken) {
      return res.status(401).json({ error: 'You must be signed in to swap.' })
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

    const walletId = await resolveWalletId(userData.userData, address as string)

    // Use the client key when provided (lets retries dedupe), else generate one.
    const idemKey =
      typeof idempotencyKey === 'string' && idempotencyKey.length > 0
        ? idempotencyKey
        : crypto.randomUUID()

    const result = await executeSwap({
      walletId,
      source: arbitrumAsset(pair.from.assetAddress),
      destination: arbitrumAsset(pair.to.assetAddress),
      baseAmount,
      slippageBps: resolvedSlippage,
      idempotencyKey: idemKey,
    })

    return res.status(200).json({
      success: true,
      actionId: result.actionId,
      walletId: result.walletId,
      status: result.status,
      fromToken: pair.from.key,
      toToken: pair.to.key,
    })
  } catch (err: any) {
    if (err instanceof PrivySwapError) {
      return res.status(err.status).json({ error: err.userMessage })
    }
    console.error('[api/privy/swap/execute] unexpected error')
    return res.status(500).json({ error: 'Something went wrong starting the swap. Please try again.' })
  }
}

export default withMiddleware(handler, rateLimit)
