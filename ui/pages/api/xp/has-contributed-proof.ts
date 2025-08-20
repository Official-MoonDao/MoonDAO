import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { getContributions } from '@/lib/coordinape/getContributions'
import { getUserId } from '@/lib/coordinape/getCoordinapeUser'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasContributedProof,
  submitHasContributedBulkClaimFor,
} from '@/lib/xp'

const CONTRIBUTIONS_THRESHOLD = BigInt(1) // changing this while using the same verifier will allow users to claim xp again

async function fetchUserContributions(user: Address): Promise<bigint> {
  try {
    // Get the user's Coordinape profile and user ID
    const coordinapeUser = await getUserId(user)

    // Get all contributions for the circle
    const allContributions = await getContributions()

    // Filter contributions for this specific user
    const userContributions = allContributions.filter(
      (contribution) => contribution.user_id === coordinapeUser.user_id
    )

    console.log(
      `Found ${userContributions.length} contributions for user ${user}`
    )

    // Return the count of contributions as a bigint
    return BigInt(userContributions.length)
  } catch (error) {
    console.error('Error fetching user contributions:', error)
    // If there's an error fetching contributions, return 0 to prevent XP claims
    return BigInt(0)
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

    // Fetch user contributions (logic to be implemented by user)
    const contributions = await fetchUserContributions(user as Address)

    if (contributions < CONTRIBUTIONS_THRESHOLD)
      return res
        .status(200)
        .json({ eligible: false, contributions: contributions.toString() })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        contributions: contributions.toString(),
        contributionsThreshold: CONTRIBUTIONS_THRESHOLD.toString(),
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper using actual contributions for bulk claiming
    const { validAfter, validBefore, signature, context } =
      await signHasContributedProof({
        user: user as Address,
        contributions: contributions, // Use actual contributions for staged bulk claiming
      })

    // Relay the bulk XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasContributedBulkClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      contributions: contributions.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      signature,
      context,
      txHash,
    })
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
