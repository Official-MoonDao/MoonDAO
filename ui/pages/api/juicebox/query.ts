import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const subgraphClient = createClient({
  url: process.env.JB_SEPOLIA_SUBGRAPH_ENDPOINT as string,
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

  try {
    const subgraphRes = await subgraphClient
      .query(query as string, {})
      .toPromise()
    const subgraphData = subgraphRes.data
    res.status(200).json(subgraphData)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch subgraph data' })
  }
}

export default withMiddleware(handler, rateLimit)
