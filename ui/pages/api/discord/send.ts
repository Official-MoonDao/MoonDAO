import { GENERAL_CHANNEL_ID, TEST_CHANNEL_ID } from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { postDiscordChannelMessage } from '@/lib/discord/postChannelMessage'

const NETWORK_NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? GENERAL_CHANNEL_ID : TEST_CHANNEL_ID

const channelIds = {
  networkNotifications: NETWORK_NOTIFICATION_CHANNEL_ID,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const type = req.query.type as keyof typeof channelIds
    if (!(type in channelIds) || !channelIds[type]) {
      return res.status(400).json({ error: 'Unknown discord channel type' })
    }
    const { message, embeds } = req.body
    const result = await postDiscordChannelMessage({
      channelId: String(channelIds[type]),
      content: message,
      embeds,
    })
    if (!result.ok) {
      return res.status(500).json({ error: 'An error occurred' })
    }
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error sending message to discord :', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}

export default withMiddleware(handler, authMiddleware)
