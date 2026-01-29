import { utils as ethersUtils } from 'ethers'
import { gql, request as gqlRequest } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasVotingPowerProof,
  submitHasVotingPowerBulkClaimFor,
} from '@/lib/xp'

const VOTING_POWER_THRESHOLD = BigInt(1) //changing this while using the same verifier will allow users to claim xp again

async function fetchSnapshotVP(user: Address, space: string): Promise<bigint> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
  {
    vp (voter: "${user}", space: "tomoondao.eth") {
      vp
    }
  }`
  try {
    const data = (await gqlRequest(endpoint, query, {
      voter: user,
      space,
    })) as any
    const value = Number(data?.vp?.vp ?? 0)
    const floored = Number.isFinite(value) ? Math.floor(value) : 0
    return BigInt(floored)
  } catch (err) {
    // Snapshot sometimes returns provider errors; treat as 0 VP rather than 500
    console.error('Snapshot VP fetch failed:', err)
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

    if (!(await addressBelongsToPrivyUser(accessToken as string, user)))
      return res.status(400).json({ error: 'User not found' })

    // Compute VP locally (Snapshot logic kept here)
    const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'
    const vp = await fetchSnapshotVP(user as Address, SNAPSHOT_SPACE)

    if (vp < VOTING_POWER_THRESHOLD)
      return res.status(200).json({ eligible: false, vp: vp.toString() })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        vp: vp.toString(),
        votingPowerThreshold: VOTING_POWER_THRESHOLD.toString(),
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper using actual voting power for bulk claiming
    const { validAfter, validBefore, signature, context } =
      await signHasVotingPowerProof({
        user: user as Address,
        votingPower: vp, // Use actual voting power for staged bulk claiming
      })

    // Relay the bulk XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasVotingPowerBulkClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      vp: vp.toString(),
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
