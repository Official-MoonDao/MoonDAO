import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accessToken } = req.body

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' })
    }

    const privyUserData = await getPrivyUserData(accessToken)

    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    return res.status(200).json({ email: privyUserData.email || null })
  } catch (error: any) {
    console.error('Error fetching user email:', error)
    return res.status(500).json({ error: 'Failed to fetch user email' })
  }
}
