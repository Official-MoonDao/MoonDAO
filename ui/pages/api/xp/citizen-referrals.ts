import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  getUserAndAccessToken,
  submitReferralBulkClaimFor,
  checkReferralBulkEligibility,
} from '@/lib/xp'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // For GET requests, check eligibility
    if (req.method === 'GET') {
      const { eligible, totalXP, highestStage, alreadyClaimed, referralCount } =
        await checkReferralBulkEligibility({
          user: user as Address,
        })

      return res.status(200).json({
        eligible,
        totalXP: totalXP.toString(),
        highestStage: highestStage.toString(),
        alreadyClaimed,
        referralCount: referralCount.toString(),
      })
    }

    // For POST requests, proceed with claiming
    const { txHash } = await submitReferralBulkClaimFor({
      user: user as Address,
    })

    return res.status(200).json({
      eligible: true,
      txHash,
    })
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
