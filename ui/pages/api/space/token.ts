import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
  MOONDAO_HAT_TREE_IDS,
} from 'const/config'
import { SignJWT } from 'jose'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getContract, readContract } from 'thirdweb'
import { getPrivyUserData } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

// Function to get team IDs for a user based on their hat membership
async function getUserTeamIds(
  walletAddress: string,
  chain: any,
  chainSlug: string
): Promise<string[]> {
  try {
    console.log('🔍 Fetching user team IDs for wallet:', walletAddress)

    // Get team contract
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

    // Fetch user's hats from the hats API (same as useTeamWearer)
    const res = await fetch('/api/hats/get-wearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chainId: chain.id,
        wearerAddress: walletAddress,
        props: {
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
        },
      }),
    })

    if (!res.ok) {
      console.error('Error fetching hats data:', res.statusText)
      return []
    }

    const hats: any = await res.json()

    // Filter worn hats to only include hats that are in the MoonDAO hat tree
    if (!hats.currentHats || hats.currentHats.length === 0) {
      console.log('No current hats found for user:', walletAddress)
      return []
    }

    const moondaoHats = hats.currentHats.filter(
      (hat: any) => hat.tree.id === MOONDAO_HAT_TREE_IDS[chainSlug]
    )

    console.log('Found MoonDAO hats:', moondaoHats.length)

    // Add the teamId to each hat (same logic as useTeamWearer)
    const teamIds: string[] = []

    for (const hat of moondaoHats) {
      try {
        const teamIdFromHat = await readContract({
          contract: teamContract,
          method: 'adminHatToTokenId' as string,
          params: [hat.id],
        })
        const teamIdFromAdmin = await readContract({
          contract: teamContract,
          method: 'adminHatToTokenId' as string,
          params: [hat.admin.id],
        })
        const teamIdFromAdminAdmin = await readContract({
          contract: teamContract,
          method: 'adminHatToTokenId' as string,
          params: [hat.admin.admin.id],
        })

        let teamId
        if (+teamIdFromHat.toString() !== 0) {
          teamId = teamIdFromHat
        } else if (+teamIdFromAdmin.toString() !== 0) {
          teamId = teamIdFromAdmin
        } else if (+teamIdFromAdminAdmin.toString() !== 0) {
          teamId = teamIdFromAdminAdmin
        } else {
          teamId = 0
        }

        if (+teamId.toString() !== 0) {
          const adminHatId = await readContract({
            contract: teamContract,
            method: 'teamAdminHat' as string,
            params: [teamId],
          })
          const prettyAdminHatId = hatIdDecimalToHex(
            BigInt(adminHatId.toString())
          )

          // Check if this hat is part of the team
          if (
            hat.id === prettyAdminHatId ||
            hat.admin.id === prettyAdminHatId ||
            hat.admin.admin.id === prettyAdminHatId ||
            hat.admin.admin.admin.id === prettyAdminHatId
          ) {
            const teamIdStr = teamId.toString()
            if (!teamIds.includes(teamIdStr)) {
              teamIds.push(teamIdStr)
            }
          }
        }
      } catch (error) {
        console.error('Error processing hat:', hat.id, error)
      }
    }

    console.log('🔍 User team IDs found:', teamIds)
    return teamIds
  } catch (error) {
    console.error('Error fetching user team IDs:', error)
    return []
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { accessToken } = req.body || {}
    if (!accessToken)
      return res.status(400).json({ error: 'Missing access token' })
    if (!process.env.SPACE_JWT_SECRET)
      return res.status(500).json({ error: 'Missing JWT secret' })

    // Get Privy user data
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    if (walletAddresses.length === 0) {
      return res
        .status(400)
        .json({ error: 'No wallet addresses found for this account' })
    }

    // Get the first wallet address
    const wallet = walletAddresses[0]

    // Query citizen NFT data
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    let citizenName = 'Unknown Citizen'

    try {
      // Query for citizen data using the wallet address
      const statement = `SELECT * FROM ${
        CITIZEN_TABLE_NAMES[chainSlug]
      } WHERE owner = '${wallet.toLowerCase()}'`

      console.log('🔍 Database query details:', {
        chain: chain,
        chainSlug: chainSlug,
        tableName: CITIZEN_TABLE_NAMES[chainSlug],
        wallet: wallet.toLowerCase(),
        statement: statement,
        env: process.env.NODE_ENV,
      })

      const citizenRows = await queryTable(chain, statement)

      console.log('🔍 Query results:', {
        rowCount: citizenRows?.length || 0,
        firstRow: citizenRows?.[0] || null,
      })

      const citizen: any = citizenRows[0]

      if (!citizen) {
        console.log('❌ No citizen found for wallet:', wallet.toLowerCase())
        return res.status(400).json({ error: 'No citizen found' })
      }

      citizenName = citizen.name || 'Unknown Citizen'
      console.log('🔍 Citizen data found:', {
        name: citizen.name,
        citizenName: citizenName,
        wallet: wallet,
      })
    } catch (error) {
      console.log('Error fetching citizen data:', error)
      return res.status(500).json({ error: 'Failed to fetch citizen data' })
    }

    // Get user's team IDs
    let userTeamIds: string[] = []
    try {
      userTeamIds = await getUserTeamIds(wallet.toLowerCase(), chain, chainSlug)
      console.log('🔍 User team IDs:', userTeamIds)
    } catch (error) {
      console.log('Error fetching user team IDs:', error)
      // Don't fail the request if team fetching fails, just continue without teams
    }

    const jwtPayload = {
      sub: wallet.toLowerCase(),
      wallet: wallet,
      name: citizenName,
      teamIds: userTeamIds,
    }

    console.log(
      '🔍 Creating JWT with payload:',
      JSON.stringify(jwtPayload, null, 2)
    )

    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(process.env.SPACE_JWT_SECRET))

    return res.status(200).json({ token })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to sign token' })
  }
}
