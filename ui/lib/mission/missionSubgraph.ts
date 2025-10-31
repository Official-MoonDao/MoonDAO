import { MOONDAO_MISSIONS_SUBGRAPH_URL } from 'const/config'
import { createClient, cacheExchange, fetchExchange } from 'urql'

const subgraphClient = createClient({
  url: MOONDAO_MISSIONS_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

// Cache for mission token addresses with 1 hour duration
let missionTokenCache: {
  addresses: Set<string>
  timestamp: number
} | null = null

const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes in milliseconds

export async function getMissionTokenAddresses(): Promise<Set<string>> {
  const now = Date.now()

  // Check if we have a valid cache
  if (missionTokenCache && now - missionTokenCache.timestamp < CACHE_DURATION) {
    // Return a new Set to avoid mutation issues
    return new Set(missionTokenCache.addresses)
  }

  // If we are in dev mode, return an empty set to reduce load on the subgraph
  if (process.env.NEXT_PUBLIC_ENV === 'dev') return new Set<string>()

  const missionTokens = new Set<string>()

  try {
    const query = `
      query {
        tokens(id: "all-tokens") {
          allTokens
        }
      }
    `

    const result = await subgraphClient.query(query, {}).toPromise()

    if (result.data?.tokens) {
      result.data.tokens.allTokens.forEach((token: any) => {
        missionTokens.add(token.toLowerCase())
      })
    }

    // Update cache with a new Set instance to prevent mutation
    missionTokenCache = {
      addresses: new Set(missionTokens),
      timestamp: now,
    }

    return missionTokens
  } catch (error) {
    console.error(
      'Error fetching mission token addresses from subgraph:',
      error
    )

    // If we have stale cache data, return it as a fallback
    if (missionTokenCache) {
      console.log('Using stale mission token cache due to error')
      return new Set(missionTokenCache.addresses)
    }
  }

  return missionTokens
}
