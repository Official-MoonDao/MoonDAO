import { getAccessToken } from '@privy-io/react-auth'

export async function unpin(hash: string): Promise<void> {
  try {
    const accessToken = await getAccessToken()
    const res = await fetch('/api/ipfs/unpin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ hash }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error unpinning :', error)
    return Promise.reject(error)
  }
}
