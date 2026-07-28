import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  arbitrumAsset,
  getSwapQuote,
  PrivySwapError,
  resolveWalletId,
} from '@/lib/privy/swaps'
import {
  humanAmountToBaseUnits,
  isSupportedSwapChainId,
  validateSwapPair,
  ARBITRUM_CHAIN_ID,
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
    const { address, fromToken, toToken, amount, chainId } = (req.body || {}) as Record<
      string,
      unknown
    >

    // --- Input validation (all server-side) ---
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'A valid wallet address is required.' })
    }
    // v1 is Arbitrum-only. If the client sends a chain, it must be Arbitrum.
    if (chainId !== undefined && !isSupportedSwapChainId(chainId as any)) {
      return res
        .status(400)
        .json({ error: 'Swaps are currently supported on Arbitrum only.' })
    }
    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'Enter a valid amount.' })
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

    const quote = await getSwapQuote({
      walletId,
      source: arbitrumAsset(pair.from.assetAddress),
      destination: arbitrumAsset(pair.to.assetAddress),
      baseAmount,
    })

    return res.status(200).json({
      success: true,
      quote: {
        fromToken: pair.from.key,
        toToken: pair.to.key,
        inputDecimals: pair.from.decimals,
        outputDecimals: pair.to.decimals,
        inputAmount: quote.inputAmount,
        estOutputAmount: quote.estOutputAmount,
        minimumOutputAmount: quote.minimumOutputAmount,
        gasEstimate: quote.gasEstimate,
        caip2: quote.caip2,
        expiresAt: quote.expiresAt,
        chainId: ARBITRUM_CHAIN_ID,
      },
    })
  } catch (err: any) {
    if (err instanceof PrivySwapError) {
      return res.status(err.status).json({ error: err.userMessage })
    }
    console.error('[api/privy/swap/quote] unexpected error')
    return res.status(500).json({ error: 'Something went wrong fetching a quote. Please try again.' })
  }
}

export default withMiddleware(handler, rateLimit)
