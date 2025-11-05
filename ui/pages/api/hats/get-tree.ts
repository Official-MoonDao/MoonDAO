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
    let treeId: string
    let props: any

    if (req.method === 'GET') {
      chainId = parseInt(req.query.chainId as string)
      treeId = req.query.treeId as string
      props = req.query.props
        ? JSON.parse(req.query.props as string)
        : undefined
    } else {
      ;({ chainId, treeId, props } = req.body)
    }

    if (!chainId || !treeId) {
      return res.status(400).json('chainId and treeId are required')
    }

    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, chainId, treeId, props')

    const tree = await hatsSubgraphClient.getTree({
      chainId,
      treeId: parseInt(treeId),
      props,
    })

    res.status(200).json(tree)
  } catch (err: any) {
    console.error(`Error fetching hat tree: ${err.message}`)
    res.status(500).json(`Error fetching hat tree: ${err.message}`)
  }
}

export default withMiddleware(handler, rateLimit)
