import { DEFAULT_CHAIN_V5, MOONDAO_HAT_TREE_IDS } from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { hatTreeMatches } from '@/lib/hats/hatTreeMatches'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  getUserAndAccessToken,
  signHasJoinedTeamProof,
  submitHasJoinedTeamClaimFor,
} from '@/lib/xp'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

// Check if user is wearing any MoonDAO team hats via the Hats Protocol subgraph.
// Calls the subgraph client directly (no internal HTTP round-trip) so this
// doesn't depend on a correctly-configured base URL at runtime.
async function hasJoinedTeam(user: Address): Promise<boolean> {
  try {
    const wearer = await hatsSubgraphClient.getWearer({
      chainId: DEFAULT_CHAIN_V5.id,
      wearerAddress: user as `0x${string}`,
      props: {
        currentHats: {
          props: {
            tree: {},
          },
        },
      },
    })

    const currentHats = (wearer as any)?.currentHats ?? []
    if (currentHats.length === 0) {
      return false
    }

    // User has joined a team if they wear any hat in the MoonDAO hat tree
    return currentHats.some((hat: any) =>
      hatTreeMatches(hat?.tree?.id, MOONDAO_HAT_TREE_IDS[chainSlug])
    )
  } catch (error: any) {
    // SDK throws when the wearer entity has never been indexed (no hats minted yet)
    if (error?.name === 'SubgraphWearerNotExistError') {
      return false
    }
    console.error('Error checking team membership via Hats subgraph:', error)
    // If there's an error checking team membership, return false to prevent XP claims
    return false
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

    // Check if user has joined a team
    const teamJoined = await hasJoinedTeam(user as Address)

    if (!teamJoined)
      return res.status(200).json({ eligible: false, teamsJoined: false })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        teamsJoined: true,
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper for regular claiming
    const { validAfter, validBefore, signature, context } =
      await signHasJoinedTeamProof({
        user: user as Address,
      })

    // Relay the XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasJoinedTeamClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      teamsJoined: true,
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
