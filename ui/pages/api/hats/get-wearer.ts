import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { setCDNCacheHeaders } from '@/lib/cache/cacheHeaders'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json('Method not allowed')
  }

  try {
    let chainId: number
    let wearerAddress: string
    let props: any

    if (req.method === 'GET') {
      chainId = parseInt(req.query.chainId as string)
      wearerAddress = req.query.wearerAddress as string
      props = req.query.props
        ? JSON.parse(req.query.props as string)
        : undefined
    } else {
      ;({ chainId, wearerAddress, props } = req.body)
    }

    if (!chainId || !wearerAddress) {
      return res.status(400).json('chainId and wearerAddress are required')
    }

    setCDNCacheHeaders(
      res,
      60,
      60,
      'Accept-Encoding, chainId, wearerAddress, props'
    )

    const wearerHats = await hatsSubgraphClient.getWearer({
      chainId,
      wearerAddress: wearerAddress as `0x${string}`,
      props,
    })

    res.status(200).json(wearerHats)
  } catch (err: any) {
    console.error(`Error fetching wearer hats: ${err.message}`)
    res.status(500).json(`Error fetching wearer hats: ${err.message}`)
  }
}

export default withMiddleware(handler, rateLimit)
