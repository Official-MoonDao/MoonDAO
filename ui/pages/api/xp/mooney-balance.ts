import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  submitHasTokenBalanceBulkClaimFor,
  signHasTokenBalanceProof,
  fetchUserMooneyBalance,
  getUserAndAccessToken,
} from '@/lib/xp'

const TOKEN_BALANCE_THRESHOLD = BigInt(100 * 1e18) // 100 tokens threshold (18 decimals)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // Fetch user's MOONEY token balance
    const tokenBalance = await fetchUserMooneyBalance(user as Address)

    if (tokenBalance < TOKEN_BALANCE_THRESHOLD) {
      return res.status(200).json({
        eligible: false,
        tokenBalance: tokenBalance.toString(),
        tokenBalanceThreshold: TOKEN_BALANCE_THRESHOLD.toString(),
        note: 'Insufficient MOONEY balance for XP claim',
      })
    }

    // For GET requests, just return eligibility info
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        tokenBalance: tokenBalance.toString(),
        tokenBalanceThreshold: TOKEN_BALANCE_THRESHOLD.toString(),
        note: 'Token balance verification requires oracle signing during claim',
      })
    }

    // For POST requests, proceed with claiming
    // Sign the proof with the oracle using the user's actual token balance
    const { validAfter, validBefore, signature, context } =
      await signHasTokenBalanceProof({
        user: user as Address,
        balance: tokenBalance,
      })

    // Submit the bulk claim with the signed oracle proof
    const { txHash } = await submitHasTokenBalanceBulkClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      tokenBalance: tokenBalance.toString(),
      tokenBalanceThreshold: TOKEN_BALANCE_THRESHOLD.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      signature,
      context,
      txHash,
      note: 'Token balance verified via oracle signing',
    })
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
