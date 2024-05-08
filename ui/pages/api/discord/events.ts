const GUILD_ID = '914720248140279868'

export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      `https://discord.com/api/v8/guilds/${GUILD_ID}/scheduled-events`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch events')
    }

    const announcements = await response.json()
    res.status(200).json(announcements)
  } catch (error) {
    console.error('Error fetching events:', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
