import { GENERAL_CHANNEL_ID, TEST_CHANNEL_ID } from 'const/config'
import { privyAuth } from 'middleware/privyAuth'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

const NETWORK_NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID // general || test-channel

const channelIds = {
  networkNotifications: NETWORK_NOTIFICATION_CHANNEL_ID,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const type = req.query.type as keyof typeof channelIds
    const { message } = req.body

    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelIds?.[type]}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
        body: JSON.stringify({ content: message }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to send message to discord')
    }

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error sending message to discord :', error)
    res.status(500).json({ error: 'An error occurred' })
  }
}

export default withMiddleware(handler, privyAuth)
