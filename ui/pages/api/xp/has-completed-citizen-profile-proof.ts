import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  getUserAndAccessToken,
  signHasCompletedCitizenProfileProof,
  submitHasCompletedCitizenProfileClaimFor,
} from '@/lib/xp'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

function isProfileFieldComplete(citizen: any, field: string): boolean {
  return JSON.stringify(citizen[field])?.trim() !== ''
}

// TODO: Implement logic to check if user has completed citizen profile
async function hasCompletedCitizenProfile(user: Address): Promise<boolean> {
  try {
    const statement = `SELECT * FROM ${
      CITIZEN_TABLE_NAMES[chainSlug]
    } WHERE owner = '${user?.toLocaleLowerCase()}'`

    const citizenRows = await queryTable(DEFAULT_CHAIN_V5, statement)

    if (citizenRows.length === 0) {
      return false
    }

    const citizen: any = citizenRows?.[0]

    const isProfileComplete =
      isProfileFieldComplete(citizen, 'description') &&
      (isProfileFieldComplete(JSON.stringify(citizen), 'location') ||
        isProfileFieldComplete(citizen, 'discord') ||
        isProfileFieldComplete(citizen, 'twitter') ||
        isProfileFieldComplete(citizen, 'website'))

    return isProfileComplete
  } catch (error) {
    console.error('Error checking citizen profile completion:', error)
    // If there's an error checking completion, return false to prevent XP claims
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

    // Check if user has completed citizen profile
    const profileCompleted = await hasCompletedCitizenProfile(user as Address)

    if (!profileCompleted)
      return res.status(200).json({ eligible: false, profileCompleted: false })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        profileCompleted: true,
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper for bulk claiming
    const { validAfter, validBefore, signature, context } =
      await signHasCompletedCitizenProfileProof({
        user: user as Address,
      })

    // Relay the XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasCompletedCitizenProfileClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      profileCompleted: true,
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
