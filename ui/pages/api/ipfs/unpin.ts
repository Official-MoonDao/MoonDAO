import { NextApiRequest, NextApiResponse } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const auth = await verifyPrivyAuth(req.headers.authorization)
    if (!auth || auth.appId !== process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      return res.status(401).json('Unauthorized')
    }

    const { hash } = req.body

    try {
      const unpinRes = await fetch(
        `https://api.pinata.cloud/pinning/unpin/${hash}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
          },
        }
      )
      const data = await unpinRes.json()
      return res.status(200).json(data)
    } catch (error) {
      console.error('Error processing request:', error)
      return res.status(500).json('Error processing request')
    }
  } else {
    return res.status(400).json('Invalid method')
  }
}
