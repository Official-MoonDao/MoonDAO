import moment from 'moment'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const CITIZEN_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/84320/moon-dao-citizens/version/latest'

const CitizenClient: any = createClient({
  url: CITIZEN_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

export async function getCitizenSubgraphData() {
  const query: any = `
    query {
      transfers(first:1000, orderBy: blockTimestamp, orderDirection: desc) {
        id
        from
        blockTimestamp
      }
    }
    `

  const citizenRes = await CitizenClient.query(query).toPromise()
  return citizenRes.data
}
