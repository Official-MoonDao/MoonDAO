import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const subgraphClient = createClient({
    url: (process.env.NEXT_PUBLIC_CHAIN == "mainnet" ?
            process.env.JB_ARBITRUM_SUBGRAPH_ENDPOINT :
            process.env.JB_SEPOLIA_SUBGRAPH_ENDPOINT) as string,
  exchanges: [fetchExchange, cacheExchange],
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.JB_SEPOLIA_SUBGRAPH_API_KEY as string,
    },
  },
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' })
  }

  try {
    const subgraphRes = await subgraphClient
      .query(query as string, {})
      .toPromise()

    if (subgraphRes.error) {
      return res.status(500).json({ error: subgraphRes.error.message })
    }

    const subgraphData = subgraphRes.data
    res.status(200).json(subgraphData)
  } catch (error) {
    console.error('Subgraph query error:', error)
    res.status(500).json({ error: 'Failed to fetch subgraph data' })
  }
}

export default withMiddleware(handler, rateLimit)
