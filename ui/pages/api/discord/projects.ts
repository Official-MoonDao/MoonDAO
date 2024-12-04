import { DISCORD_GUILD_ID } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'

const PROJECTS_CATEGORY_ID = '947986865607311390'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const type = req.query.type
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch messages from discord')
    }

    const channels = await response.json()
    const projects = channels.filter(
      (channel: any) => channel.parent_id === PROJECTS_CATEGORY_ID
    )

    res.status(200).json(projects)
  } catch (error) {
    console.error('Error fetching messages from discord :', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
