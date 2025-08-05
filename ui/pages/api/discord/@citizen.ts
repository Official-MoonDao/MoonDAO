import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  DISCORD_GUILD_ID,
  DISCORD_CITIZEN_ROLE_ID,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getContract, readContract } from 'thirdweb'
import { assignDiscordRole } from '@/lib/discord/assignRole'
import { getPrivyUserData } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accessToken } = req.body

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' })
    }

    // Get Privy user data
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const { walletAddresses, discordAccount } = privyUserData

    if (walletAddresses.length === 0) {
      return res
        .status(400)
        .json({ error: 'No wallet addresses found for this account' })
    }

    if (!discordAccount) {
      return res
        .status(400)
        .json({ error: 'No Discord account linked to this Privy account' })
    }

    // Check if any of the wallet addresses own a Citizen NFT
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const citizenContractAddress = CITIZEN_ADDRESSES[chainSlug]

    if (!citizenContractAddress) {
      return res
        .status(500)
        .json({ error: 'Citizen contract not found for current chain' })
    }

    const citizenContract = getContract({
      client,
      address: citizenContractAddress,
      chain: DEFAULT_CHAIN_V5,
      abi: CitizenABI as any,
    })

    let hasCitizenNFT = false
    let citizenAddress = ''

    // Check each wallet address for Citizen NFT ownership
    for (const address of walletAddresses) {
      try {
        const ownedTokenId = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [address],
        })

        // If we get here without error, the address owns a Citizen NFT
        if (ownedTokenId) {
          hasCitizenNFT = true
          citizenAddress = address
          break
        }
      } catch (err: any) {
        // Error means no token owned for this address, continue to next address
        console.log(`No Citizen NFT found for address: ${address}`)
      }
    }

    if (!hasCitizenNFT) {
      return res.status(404).json({
        error: 'No Citizen NFT found for any linked wallet addresses',
        walletAddresses: walletAddresses,
      })
    }

    // Assign Discord role using the extracted function
    const roleResult = await assignDiscordRole({
      discordUsername: discordAccount.username, // Discord user ID from linked account
      guildId: DISCORD_GUILD_ID,
      roleId: DISCORD_CITIZEN_ROLE_ID,
      botToken: process.env.DISCORD_BOT_TOKEN as string,
    })

    if (!roleResult.success) {
      return res
        .status(
          roleResult.error === 'Discord user not found in the server'
            ? 404
            : 500
        )
        .json({
          error: roleResult.error,
          details: roleResult.details,
        })
    }

    return res.status(200).json({
      success: true,
      message: 'Citizen role successfully assigned',
      data: {
        ...roleResult.data,
        citizenAddress: citizenAddress,
      },
    })
  } catch (error) {
    console.error('Error in citizen role assignment:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
