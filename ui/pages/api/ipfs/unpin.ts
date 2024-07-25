import { privyAuth } from 'middleware/privyAuth'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { hash } = req.body

    try {
      const unpinRes = await fetch(
        `https://api.pinata.cloud/pinning/unpin/${hash}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
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

export default withMiddleware(handler, privyAuth)
