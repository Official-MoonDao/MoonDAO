import { utils as ethersUtils } from 'ethers'
import { gql, request as gqlRequest } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasVotedProof,
  submitHasVotedBulkClaimFor,
} from '@/lib/xp'

const VOTES_THRESHOLD = 1 //changing this while using the same verifier will allow users to claim xp again

async function fetchSnapshotVotesCount(
  user: Address,
  space: string
): Promise<number> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
    query Votes($address: String!) {
      votes(
        first: 1000
        skip: 0
        where: { voter: $address, space: "tomoondao.eth" }
      ) {
        id
        voter
        choice
        created
        space {
          id
        }
      }
    }
  `
  try {
    const data = (await gqlRequest(endpoint, query, {
      address: user,
    })) as any
    const count = Array.isArray(data?.votes) ? data.votes.length : 0
    return count
  } catch (err) {
    console.error('Snapshot votes fetch failed:', err)
    return 0
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

    const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'
    const votesCount = await fetchSnapshotVotesCount(
      user as Address,
      SNAPSHOT_SPACE
    )

    if (votesCount < VOTES_THRESHOLD)
      return res.status(200).json({ eligible: false, votesCount })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        votesCount,
        votesThreshold: VOTES_THRESHOLD,
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper using actual vote count for claiming

    const { validAfter, validBefore, signature, context } =
      await signHasVotedProof({
        user: user as Address,
        votes: BigInt(votesCount), // Use actual vote count
        authToken: process.env.HSM_AUTH_TOKEN, // Use server-side auth token
      })

    const { txHash } = await submitHasVotedBulkClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      votesCount,
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
