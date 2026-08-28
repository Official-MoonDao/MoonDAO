import type { DiscordEmbed } from '@/lib/og/preview'

export type { DiscordEmbed }

export default async function sendDiscordMessage(
  type: 'networkNotifications',
  message: string,
  embeds?: DiscordEmbed[]
) {
  try {
    const response = await fetch(`/api/discord/send?type=${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, embeds }),
    })

    if (!response.ok) {
      throw new Error('Failed to send message to discord')
    }
  } catch (err) {
    console.error('Error sending message to discord :', err)
  }
}
