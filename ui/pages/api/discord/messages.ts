import { NextApiRequest, NextApiResponse } from 'next'

const channelIDs: any = {
  announcements: '914976122855374958',
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const type = req.query.type as keyof typeof channelIDs
    const beforeMessageId = req.query.before
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelIDs[type]}/messages${
        beforeMessageId ? `?before=${beforeMessageId}` : ''
      }`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch messages from discord')
    }

    const messages = await response.json()
    res.status(200).json(messages)
  } catch (error) {
    console.error('Error fetching messages from discord :', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
