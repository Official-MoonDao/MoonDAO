// Inside your Next.js API route
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { chainId, wearerAddress, props } = req.body
    try {
      const wearerHats = await hatsSubgraphClient.getWearer({
        chainId,
        wearerAddress,
        props,
      })

      res.status(200).json(wearerHats)
    } catch (err: any) {
      console.error(`Error fetching wearer hats: ${err.message}`)
      res.status(500).json(`Error fetching wearer hats: ${err.message}`)
    }
  } else {
    res.status(405).json('Method not allowed')
  }
}

export default withMiddleware(handler, rateLimit)
