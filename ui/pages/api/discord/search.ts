const GUILD_ID = '914720248140279868'

export default async function handler(req: any, res: any) {
  try {
    const username = req.query.username
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/search?query=${username}&limit=10`,
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

    const ret = await response.json()
    res.status(200).json(ret)
  } catch (error) {
    console.error('Error searching username:', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
