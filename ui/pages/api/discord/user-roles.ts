import { DISCORD_GUILD_ID } from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accessToken } = req.query

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Access token is required' })
    }

    // Get Privy user data
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const { discordAccount } = privyUserData

    if (!discordAccount) {
      return res.status(400).json({ 
        error: 'No Discord account linked to this Privy account',
        roles: []
      })
    }

    // Fetch user's guild member data to get their roles
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordAccount.subject}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!memberResponse.ok) {
      if (memberResponse.status === 404) {
        return res.status(404).json({ 
          error: 'User not found in Discord server',
          roles: []
        })
      }
      const errorText = await memberResponse.text()
      return res.status(500).json({ 
        error: 'Failed to fetch user roles from Discord',
        details: errorText,
        roles: []
      })
    }

    const memberData = await memberResponse.json()
    const userRoles = memberData.roles || []

    return res.status(200).json({
      success: true,
      roles: userRoles,
      discordUserId: discordAccount.subject
    })
  } catch (error) {
    console.error('Error fetching Discord user roles:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      roles: []
    })
  }
}

export default withMiddleware(handler, authMiddleware)
