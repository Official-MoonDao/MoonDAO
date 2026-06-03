import { utils as ethersUtils } from 'ethers'
import { gql, request as gqlRequest } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import {
  DEFAULT_CHAIN_V5,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  getUserAndAccessToken,
  signHasVotedProof,
  submitHasVotedBulkClaimFor,
} from '@/lib/xp'

const VOTES_THRESHOLD = 1 //changing this while using the same verifier will allow users to claim xp again

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Count votes a user has cast through the current on-chain governance system:
// project/member votes live in the Proposals table and non-project governance
// votes live in the NonProjectProposal table. Each row is one cast vote.
async function fetchOnchainVotesCount(user: Address): Promise<number> {
  const address = user.toLowerCase()
  const tables = [
    PROPOSALS_TABLE_NAMES[chainSlug],
    NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug],
  ].filter(Boolean)

  let total = 0
  for (const table of tables) {
    try {
      const statement = `SELECT COUNT(*) AS c FROM ${table} WHERE LOWER(address) = '${address}'`
      const rows = (await queryTable(chain, statement)) as Array<{
        c: number | string
      }>
      total += Number(rows?.[0]?.c ?? 0)
    } catch (err) {
      console.error(`On-chain votes fetch failed for ${table}:`, err)
    }
  }
  return total
}

const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'

// Legacy: votes cast in MoonDAO's historical Snapshot space. Retained so
// Citizens who voted before the migration to on-chain governance still qualify.
async function fetchSnapshotVotesCount(user: Address): Promise<number> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
    query Votes($address: String!) {
      votes(
        first: 1000
        skip: 0
        where: { voter: $address, space: "${SNAPSHOT_SPACE}" }
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

async function fetchVotesCount(user: Address): Promise<number> {
  const [onchain, snapshot] = await Promise.all([
    fetchOnchainVotesCount(user),
    fetchSnapshotVotesCount(user),
  ])
  return onchain + snapshot
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

    const votesCount = await fetchVotesCount(user as Address)

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
