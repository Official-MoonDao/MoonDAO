import { NextApiRequest, NextApiResponse } from 'next'

const GUILD_ID = '914720248140279868'

export default async function handler(req: NextApiRequest,
  res: NextApiResponse) {
  try {
    const username = req.query.username
    console.log('Discord search request for:', username)
    console.log('Bot token exists:', !!process.env.DISCORD_BOT_TOKEN)
    console.log('Bot token starts with:', process.env.DISCORD_BOT_TOKEN?.substring(0, 10))
    
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/search?query=${username}&limit=10`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    console.log('Discord API response status:', response.status)
    console.log('Discord API response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Discord API error response:', errorText)
      throw new Error(`Failed to search username: ${response.status} - ${errorText}`)
    }

    const ret = await response.json()
    res.status(200).json(ret)
  } catch (error: any) {
    console.error('Error searching username:', error)
    res.status(500).json({ success: false, error: error.toString() })
  }
}
