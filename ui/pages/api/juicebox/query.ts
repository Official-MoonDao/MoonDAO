import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const subgraphUrl = `https://${
  process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' && 'testnet.'
}bendystraw.xyz/${process.env.BENDYSTRAW_KEY}/graphql`

const subgraphClient = createClient({
  url: subgraphUrl,
  exchanges: [fetchExchange, cacheExchange],
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle both GET (legacy) and POST (with variables) requests
  let query: string
  let variables: any = {}

  if (req.method === 'POST') {
    // For POST requests, expect query and variables in body
    const body = req.body
    query = body.query
    variables = body.variables || {}
  } else {
    // For GET requests, use query parameter (legacy support)
    query = req.query.query as string
  }

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' })
  }

  try {
    const subgraphRes = await subgraphClient.query(query, variables).toPromise()

    if (subgraphRes.error) {
      console.error('GraphQL Error:', subgraphRes.error)
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
