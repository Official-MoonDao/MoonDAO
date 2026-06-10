import { getAccessToken } from '@privy-io/react-auth'

/**
 * POSTs a fire-and-forget network notification to Discord via `/api/discord/send`.
 *
 * The `/api/discord/send` route is wrapped in `authMiddleware`, which 401s
 * unless the request includes either a valid NextAuth session cookie OR an
 * `Authorization: Bearer ${accessToken}` header. Privy-only flows (the common
 * case — new citizens, team creation, contributions, job postings, marketplace
 * listings) don't reliably have a NextAuth cookie, so without the Bearer header
 * the request silently 401s and the Discord message never posts. We always
 * attach the Privy access token to avoid that.
 */
export default async function sendDiscordMessage(
  type: 'networkNotifications',
  message: string
) {
  try {
    const accessToken = await getAccessToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(`/api/discord/send?type=${type}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      throw new Error(
        `Failed to send message to discord (status ${response.status})`
      )
    }
  } catch (err) {
    console.error('Error sending message to discord :', err)
  }
}
