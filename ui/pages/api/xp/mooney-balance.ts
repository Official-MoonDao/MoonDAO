import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import { submitHasTokenBalanceBulkClaimFor } from '@/lib/xp'

const MIN_TOKEN_BALANCE = BigInt(100 * 1e18) // 100 tokens minimum (18 decimals)

function getUserAndAccessToken(req: NextApiRequest) {
  if (req.method === 'GET') {
    const { user, accessToken } = req.query as {
      user?: string
      accessToken?: string
    }
    return { user, accessToken }
  } else {
    const { user, accessToken } = JSON.parse(req.body) as {
      user?: string
      accessToken?: string
    }
    return { user, accessToken }
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // For GET requests, just return eligibility info
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true, // Always eligible since verification happens on-chain
        minTokenBalance: MIN_TOKEN_BALANCE.toString(),
        note: 'Token balance verification happens on-chain during claim',
      })
    }

    // For POST requests, proceed with claiming
    // Since HasTokenBalanceStaged doesn't require oracle signing, we can proceed directly
    // The contract will verify the token balance on-chain during the claim

    // Submit the bulk claim - the contract will verify eligibility on-chain
    const { txHash } = await submitHasTokenBalanceBulkClaimFor({
      user: user as Address,
      verifierId: BigInt(2), // Token balance verifier ID from config
    })

    return res.status(200).json({
      eligible: true,
      minTokenBalance: MIN_TOKEN_BALANCE.toString(),
      txHash,
      note: 'Token balance verified on-chain during claim',
    })
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
