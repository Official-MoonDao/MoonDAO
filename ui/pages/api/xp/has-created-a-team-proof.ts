import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasCreatedTeamProof,
  submitHasCreatedTeamClaimFor,
} from '@/lib/xp'

const TEAMS_CREATED_THRESHOLD = BigInt(1) // Teams required to be eligible

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // TODO: You will implement the function that checks if the address has created a team
    // For now, this is a placeholder that assumes the user has created at least 1 team
    // Replace this with your actual team creation check function
    const teamsCreated = BigInt(1) // This should come from your team creation check function

    if (teamsCreated < TEAMS_CREATED_THRESHOLD)
      return res
        .status(200)
        .json({ eligible: false, teamsCreated: teamsCreated.toString() })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        teamsCreated: teamsCreated.toString(),
        teamsCreatedThreshold: TEAMS_CREATED_THRESHOLD.toString(),
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper using actual teams created for bulk claiming
    const { validAfter, validBefore, signature, context } =
      await signHasCreatedTeamProof({
        user: user as Address,
        teamsCreated: teamsCreated, // Use actual teams created for staged bulk claiming
      })

    // Relay the XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasCreatedTeamClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      teamsCreated: teamsCreated.toString(),
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
