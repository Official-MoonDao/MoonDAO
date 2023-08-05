const CHANNEL_ID = '914976122855374958'

export default async function handler(req: any, res: any) {
  try {
    const beforeMessageId = req.query.before
    const response = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages${
        beforeMessageId ? `?before=${beforeMessageId}` : ''
      }`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, // Remove the colon after "Bearer"
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch announcements')
    }

    const announcements = await response.json()
    res.status(200).json(announcements)
  } catch (error) {
    console.error('Error fetching announcements:', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
