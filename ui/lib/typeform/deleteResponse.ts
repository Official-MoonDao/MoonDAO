import { getAccessToken } from '@privy-io/react-auth'

export default async function deleteResponse(
  formId: string,
  responseId: string
) {
  try {
    const accessToken = await getAccessToken()
    const res = await fetch('/api/typeform/delete-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ formId, responseId, accessToken }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.error('Error deleting response:', err)
  }
}
