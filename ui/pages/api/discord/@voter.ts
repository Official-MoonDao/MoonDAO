import { DISCORD_GUILD_ID, DISCORD_VOTER_ROLE_ID } from 'const/config'
import request, { gql } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { assignDiscordRoleById } from '@/lib/discord/assignRole'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

async function checkVotingPower(address: string): Promise<number> {
  try {
    const query = gql`
      {
        vp (voter: "${address}", space: "tomoondao.eth") {
          vp
        }
      }`

    const { vp } = (await request(
      `https://hub.snapshot.org/graphql`,
      query
    )) as any

    return vp?.vp || 0
  } catch (error) {
    console.log(`Error checking voting power for address: ${address}`, error)
    return 0
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accessToken } = req.body

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' })
    }

    // Verify Privy auth and get user data
    const verifiedClaims = await verifyPrivyAuth(accessToken)
    if (!verifiedClaims) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    // Fetch user data with linked accounts from Privy API
    const userResponse = await fetch(
      `https://auth.privy.io/api/v1/users/${verifiedClaims.userId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.NEXT_PUBLIC_PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`
          ).toString('base64')}`,
          'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
        },
      }
    )

    if (!userResponse.ok) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch user data from Privy' })
    }

    const userData = await userResponse.json()
    const walletAddresses: string[] = []
    let discordAccount: any = null

    // Extract wallet addresses from the user's linked accounts
    if (userData.linked_accounts) {
      for (const account of userData.linked_accounts) {
        if (account.type === 'wallet' && account.address) {
          walletAddresses.push(account.address)
        }
        // Find the Discord account
        if (account.type === 'discord_oauth') {
          discordAccount = account
        }
      }
    }

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

    // Check if any of the wallet addresses have voting power
    let hasVotingPower = false
    let voterAddress = ''
    let totalVotingPower = 0

    for (const address of walletAddresses) {
      const votingPower = await checkVotingPower(address)

      if (votingPower > 0) {
        hasVotingPower = true
        voterAddress = address
        totalVotingPower += votingPower
      }
    }

    if (!hasVotingPower) {
      return res.status(404).json({
        error: 'No voting power found for any linked wallet addresses',
        walletAddresses: walletAddresses,
      })
    }

    // Assign Discord voter role using the Discord user ID
    const roleResult = await assignDiscordRoleById({
      discordUserId: discordAccount.subject, // Discord user ID from linked account
      guildId: DISCORD_GUILD_ID,
      roleId: DISCORD_VOTER_ROLE_ID,
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
      message: 'Voter role successfully assigned',
      data: {
        ...roleResult.data,
        voterAddress: voterAddress,
        totalVotingPower: totalVotingPower,
      },
    })
  } catch (error) {
    console.error('Error in voter role assignment:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
