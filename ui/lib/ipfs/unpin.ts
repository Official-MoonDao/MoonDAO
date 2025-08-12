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

export async function unpinCitizenImage(citizenId: string) {
  try {
    const accessToken = await getAccessToken()
    const res = await fetch('/api/ipfs/unpinCitizenImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ citizenId, accessToken }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error unpinning citizen image:', error)
    return Promise.reject(error)
  }
}

export async function unpinTeamImage(teamId: string) {
  try {
    const accessToken = await getAccessToken()
    const res = await fetch('/api/ipfs/unpinTeamImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ teamId, accessToken }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error unpinning team image:', error)
    return Promise.reject(error)
  }
}
