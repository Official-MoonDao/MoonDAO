export default async function sendDiscordMessage(
  accessToken: any,
  type: 'networkNotifications',
  message: string
) {
  try {
    const response = await fetch(`/api/discord/send?type=${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      throw new Error('Failed to send message to discord')
    }
  } catch (err) {
    console.error('Error sending message to discord :', err)
  }
}
