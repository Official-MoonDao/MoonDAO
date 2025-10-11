import { cacheExchange, createClient, fetchExchange } from 'urql'

const SUBGRAPH_CONFIG = {
  v3: {
    ethereum: {
      id: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    },
    arbitrum: {
      id: 'FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX',
    },
    polygon: {
      id: '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm',
    },
    base: {
      id: '',
    },
  },
  v4: {
    ethereum: {
      id: 'AdA6Ax3jtct69NnXfxNjWtPTe9gMtSEZx2tTQcT4VHu',
    },
    arbitrum: {
      id: '655x11nEGRudi5Nh4attV1uMt2YnyFRMaSKRM5QndXLK',
    },
    polygon: {
      id: '2UKncUpdgZeJVyh6Dv8ai2fTL2MQnig8ySh7YkYcHCsL',
    },
    base: {
      id: '6UjxSFHTUa98Y4Uh4Tb6suPVyYxgPHpPEPfmFNihzTHp',
    },
  },
} as const

type UniswapSubgraphChain = keyof typeof SUBGRAPH_CONFIG.v3
type UniswapVersion = keyof typeof SUBGRAPH_CONFIG

const theGraphApiKey = process.env.THE_GRAPH_API_KEY

function createSubgraphClient(
  version: UniswapVersion,
  chain: UniswapSubgraphChain
) {
  const subgraphConfig = SUBGRAPH_CONFIG[version][chain]
  if (!subgraphConfig || !subgraphConfig.id) return null

  return createClient({
    url: `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${subgraphConfig.id}`,
    exchanges: [fetchExchange, cacheExchange],
  })
}

const subgraphClients = {
  v3: {
    ethereum: createSubgraphClient('v3', 'ethereum')!,
    arbitrum: createSubgraphClient('v3', 'arbitrum')!,
    polygon: createSubgraphClient('v3', 'polygon')!,
  },
  v4: {
    ethereum: createSubgraphClient('v4', 'ethereum'),
    arbitrum: createSubgraphClient('v4', 'arbitrum'),
    polygon: createSubgraphClient('v4', 'polygon'),
    base: createSubgraphClient('v4', 'base'),
  },
}

export type PoolSubgraphQueryData = {
  address: string
  chain: string
  version?: 'v3' | 'v4'
}

export interface PoolDayData {
  date: number
  tvlUSD: string
  feesUSD: string
  volumeUSD: string
  pool: { id: string }
}

export interface Position {
  id: string
  owner: string
  liquidity: string
  tickLower: { tickIdx: string }
  tickUpper: { tickIdx: string }
  depositedToken0: string
  depositedToken1: string
  withdrawnToken0: string
  withdrawnToken1: string
  collectedFeesToken0: string
  collectedFeesToken1: string
  pool: {
    id: string
    token0: { id: string; symbol: string; decimals: string }
    token1: { id: string; symbol: string; decimals: string }
    tick: string
    feeTier: string
  }
  transaction: {
    timestamp: string
  }
}

export interface Collect {
  id: string
  position: { id: string }
  amount0: string
  amount1: string
  amountUSD: string
  timestamp: string
}

function detectPoolVersion(
  pools: PoolSubgraphQueryData[]
): PoolSubgraphQueryData[] {
  return pools.map((pool) => ({
    ...pool,
    version: pool.version || 'v3',
  }))
}

async function querySubgraph<T>(
  client: any,
  query: string,
  variables: any,
  chainName: string,
  version: string
): Promise<T[]> {
  if (!client) {
    console.log(`⚠️ ${version} ${chainName}: Subgraph not available yet`)
    return []
  }

  try {
    const pools = variables.pools
    if (pools.length === 0) return []

    console.log(
      `🔄 Querying ${version} ${chainName} pools: ${pools.join(', ')}`
    )

    const response = await client.query(query, variables).toPromise()

    if (response?.data?.poolDayDatas) {
      return response.data.poolDayDatas
    } else {
      console.log(`⚠️ ${version} ${chainName}: No data returned`)
      return []
    }
  } catch (error) {
    console.error(
      `Error fetching Uniswap ${version} ${chainName.toUpperCase()} subgraph data:`,
      error
    )
    return []
  }
}

export async function getUniswapHistoricalPoolData(
  pools: PoolSubgraphQueryData[],
  days: number
): Promise<PoolDayData[]> {
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

  const poolsWithVersion = detectPoolVersion(pools)
  const v3Pools = poolsWithVersion.filter((pool) => pool.version === 'v3')
  const v4Pools = poolsWithVersion.filter((pool) => pool.version === 'v4')

  const poolsByChainAndVersion = {
    v3: {
      ethereum: v3Pools
        .filter((p) => p.chain === 'ethereum')
        .map((p) => p.address),
      arbitrum: v3Pools
        .filter((p) => p.chain === 'arbitrum')
        .map((p) => p.address),
      polygon: v3Pools
        .filter((p) => p.chain === 'polygon')
        .map((p) => p.address),
      base: v3Pools.filter((p) => p.chain === 'base').map((p) => p.address),
    },
    v4: {
      ethereum: v4Pools
        .filter((p) => p.chain === 'ethereum')
        .map((p) => p.address),
      arbitrum: v4Pools
        .filter((p) => p.chain === 'arbitrum')
        .map((p) => p.address),
      polygon: v4Pools
        .filter((p) => p.chain === 'polygon')
        .map((p) => p.address),
      base: v4Pools.filter((p) => p.chain === 'base').map((p) => p.address),
    },
  }

  // Query all chains and versions in parallel
  const queryPromises: Promise<PoolDayData[]>[] = []

  // V3 queries
  for (const [chain, poolAddresses] of Object.entries(
    poolsByChainAndVersion.v3
  )) {
    if (poolAddresses.length > 0) {
      const client =
        subgraphClients.v3[chain as keyof typeof subgraphClients.v3]
      queryPromises.push(
        querySubgraph<PoolDayData>(
          client,
          query,
          { pools: poolAddresses, dateFrom, dateTo },
          chain,
          'V3'
        )
      )
    }
  }

  // V4 queries
  for (const [chain, poolAddresses] of Object.entries(
    poolsByChainAndVersion.v4
  )) {
    if (poolAddresses.length > 0) {
      const client = subgraphClients.v4[chain as UniswapSubgraphChain]
      queryPromises.push(
        querySubgraph<PoolDayData>(
          client,
          query,
          { pools: poolAddresses, dateFrom, dateTo },
          chain,
          'V4'
        )
      )
    }
  }

  const results = await Promise.all(queryPromises)
  const allPoolData = results.flat()

  return allPoolData
}
