import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json('Method not allowed')
  }

  try {
    let chainId: number
    let hatId: string
    let props: any

    if (req.method === 'GET') {
      chainId = parseInt(req.query.chainId as string)
      hatId = req.query.hatId as string
      props = req.query.props
        ? JSON.parse(req.query.props as string)
        : undefined
    } else {
      ;({ chainId, hatId, props } = req.body)
    }

    if (!chainId || !hatId) {
      return res.status(400).json('chainId and hatId are required')
    }

    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, chainId, hatId, props')

    const hat = await hatsSubgraphClient.getHat({
      chainId,
      hatId: hatId as any,
      props,
    })

    res.status(200).json(hat)
  } catch (err: any) {
    console.error(`Error fetching hat: ${err.message}`)
    res.status(500).json(`Error fetching hat: ${err.message}`)
  }
}

export default withMiddleware(handler, rateLimit)
