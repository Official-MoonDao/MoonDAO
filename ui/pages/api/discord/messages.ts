import { NextApiRequest, NextApiResponse } from 'next'

const channelIDs: any = {
  announcements: '914976122855374958',
}

function isMessageContentRedacted(messages: unknown) {
  if (!Array.isArray(messages) || messages.length === 0) return false
  return messages.every((message) => {
    if (!message || typeof message !== 'object') return false
    const record = message as {
      content?: string
      embeds?: unknown[]
      attachments?: unknown[]
    }
    return !record.content && !(record.embeds || []).length && !(record.attachments || []).length
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    if (isMessageContentRedacted(messages)) {
      console.warn(
        'Discord returned announcement messages without content. The bot is missing the Message Content privileged intent.'
      )
    }
    res.status(200).json(messages)
  } catch (error) {
    console.error('Error fetching messages from discord :', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}
