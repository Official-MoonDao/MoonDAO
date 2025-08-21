import { MOONDAO_MISSIONS_SUBGRAPH_URL } from 'const/config'
import { createClient, cacheExchange, fetchExchange } from 'urql'

const subgraphClient = createClient({
  url: MOONDAO_MISSIONS_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

export async function getMissionTokenAddresses(): Promise<Set<string>> {
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
    return missionTokens
  } catch (error) {
    console.error(
      'Error fetching mission token addresses from subgraph:',
      error
    )
  }

  return missionTokens
}
