import { utils as ethersUtils } from 'ethers'
import { gql, request as gqlRequest } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { signHasVotedProof, submitHasVotedClaimFor } from '../../../lib/oracle'
import { addressBelongsToPrivyUser } from '@/lib/privy'

const MIN_VOTES = BigInt(1)
const XP = BigInt(10)

type Address = `0x${string}`

async function fetchSnapshotVotesCount(
  user: Address,
  space: string
): Promise<number> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
    votes(
      first: 1000
      skip: 0
      where: { voter: ${user}, space: "tomoondao.eth" }
    ) {
      id
      voter
      choice
      created
      space {
        id
      }
    }
  `
  try {
    const data = (await gqlRequest(endpoint, query, {
      voter: user,
      spaces: [space],
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
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = JSON.parse(req.body) as {
      user?: string
      accessToken?: string
    }
    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'
    const votesCount = await fetchSnapshotVotesCount(
      user as Address,
      SNAPSHOT_SPACE
    )
    if (votesCount < Number(MIN_VOTES))
      return res.status(200).json({ eligible: false, votesCount })

    if (XP === BigInt(0))
      return res.status(200).json({ eligible: false, votesCount })

    const { validAfter, validBefore, signature, context } =
      await signHasVotedProof({
        user: user as Address,
        minVotes: MIN_VOTES,
        xpAmount: XP,
      })

    const { txHash } = await submitHasVotedClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      votesCount,
      xpAmount: XP.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      signature,
      context,
      txHash,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
