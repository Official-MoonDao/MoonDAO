import { DEFAULT_CHAIN_V5, MOONDAO_HAT_TREE_IDS } from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  getUserAndAccessToken,
  signHasJoinedTeamProof,
  submitHasJoinedTeamClaimFor,
} from '@/lib/xp'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

// Check if user has joined a team using Hats Protocol subgraph
async function hasJoinedTeam(user: Address): Promise<boolean> {
  try {
    // Use the Hats subgraph to check if user is wearing any MoonDAO team hats
    // Need to use absolute URL when calling from API route to API route
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'
    const propsParam = encodeURIComponent(
      JSON.stringify({
        currentHats: {
          props: {
            tree: {},
            admin: {
              admin: {
                admin: {},
              },
            },
          },
        },
      })
    )
    const res = await fetch(
      `${baseUrl}/api/hats/get-wearer?chainId=${DEFAULT_CHAIN_V5.id}&wearerAddress=${user}&props=${propsParam}`
    )

    if (!res.ok) {
      console.error('Error fetching hats data:', res.statusText)
      return false
    }

    const hats: any = await res.json()

    console.log('hats', hats)

    // Check if user has any current hats
    if (!hats.currentHats || hats.currentHats.length === 0) {
      return false
    }

    // Filter hats to only include those in the MoonDAO hat tree
    const moondaoHats = hats.currentHats.filter(
      (hat: any) => hat.tree.id === MOONDAO_HAT_TREE_IDS[chainSlug]
    )

    // If user has any MoonDAO hats, they've joined a team
    return moondaoHats.length > 0
  } catch (error) {
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

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // Check if user has joined a team
    const teamJoined = await hasJoinedTeam(user as Address)

    if (!teamJoined)
      return res.status(200).json({ eligible: false, teamJoined: false })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        teamJoined: true,
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
      teamJoined: true,
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
