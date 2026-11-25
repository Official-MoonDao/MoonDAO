import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { toPublicDiscordMembers } from '@/lib/discord/publicMembers'

const GUILD_ID = '914720248140279868'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const username = req.query.username
    if (typeof username !== 'string' || username === '') {
      return res.status(400).json({ success: false, error: 'Username is required' })
    }
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/search?query=${encodeURIComponent(
        username
      )}&limit=10`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      console.debug(response.status)
      throw new Error('Failed to search username')
    }

    res.status(200).json(toPublicDiscordMembers(await response.json()))
  } catch (error: any) {
    console.error('Error searching username:', error)
    res.status(500).json({ success: false, error: 'Failed to search username' })
  }
}

export default withMiddleware(handler, rateLimit)
