import { cacheExchange, createClient, fetchExchange } from 'urql'

const UNISWAP_V3_ETHEREUM_SUBGRAPH_ID =
  '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'

const UNISWAP_V3_ARBITRUM_SUBGRAPH_ID =
  'FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX'

const UNISWAP_V3_POLYGON_SUBGRAPH_ID =
  '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm'

const UNISWAP_V3_BASE_SUBGRAPH_ID =
  '5EEDKEx8y9GtJ5B344i1QdK5kGQXjTpQV99C5u1dHJ28'

const theGraphApiKey = process.env.THE_GRAPH_API_KEY

const ethSubgraphClient = createClient({
  url: `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${UNISWAP_V3_ETHEREUM_SUBGRAPH_ID}`,
  exchanges: [fetchExchange, cacheExchange],
})

const arbitrumSubgraphClient = createClient({
  url: `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${UNISWAP_V3_ARBITRUM_SUBGRAPH_ID}`,
  exchanges: [fetchExchange, cacheExchange],
})

const polygonSubgraphClient = createClient({
  url: `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${UNISWAP_V3_POLYGON_SUBGRAPH_ID}`,
  exchanges: [fetchExchange, cacheExchange],
})

const baseSubgraphClient = createClient({
  url: `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${UNISWAP_V3_BASE_SUBGRAPH_ID}`,
  exchanges: [fetchExchange, cacheExchange],
})

export type PoolSubgraphQueryData = {
  address: string
  chain: string
}

export async function getUniswapHistoricalPoolData(
  pools: PoolSubgraphQueryData[],
  days: number
) {
  const query = `
    query PoolDailyContext(
        $pools: [String!]!,
        $dateFrom: Int!,
        $dateTo: Int!,
        $first: Int = 1000,
        $skip: Int = 0
        ) {
        poolDayDatas(
            first: $first
            skip: $skip
            orderBy: date
            orderDirection: asc
            where: { pool_in: $pools, date_gte: $dateFrom, date_lte: $dateTo }
        ) {
            date
            tvlUSD
            feesUSD
            volumeUSD
            pool { id }
        }
    }
    `

  const dateFrom = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60
  const dateTo = Math.floor(Date.now() / 1000)

  try {
    const ethRes = await ethSubgraphClient
      .query(query, {
        pools: pools
          .filter((pool) => pool.chain === 'ethereum')
          .map((pool) => pool.address),
        dateFrom,
        dateTo,
      })
      .toPromise()

    const ethData = ethRes?.data
    console.log('UNISWAP V3 ETH DATA', ethData)
  } catch (error) {
    console.error('Error fetching Uniswap V3 ETH subgraph data:', error)
  }

  try {
    const polygonRes = await polygonSubgraphClient
      .query(query, {
        pools: pools
          .filter((pool) => pool.chain === 'polygon')
          .map((pool) => pool.address),
        dateFrom,
        dateTo,
      })
      .toPromise()

    const polygonData = polygonRes?.data
    console.log('UNISWAP V3 POLYGON DATA', polygonData)
  } catch (error) {
    console.error('Error fetching Uniswap V3 POLYGON subgraph data:', error)
  }
}
