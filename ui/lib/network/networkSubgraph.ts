import { MOONDAO_NETWORK_SUBGRAPH_URL } from 'const/config'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const subgraphClient = createClient({
  url: MOONDAO_NETWORK_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

export interface CitizenTransfer {
  id: string
  tokenId: string
  transactionHash: string
  ethValue: string
  blockTimestamp: string
  blockNumber: string
}

export interface TeamTransfer {
  id: string
  ethValue: string
  tokenId: string
  blockTimestamp: string
  blockNumber: string
}

export interface AllTransfersResult {
  citizenTransfers: CitizenTransfer[]
  teamTransfers: TeamTransfer[]
}

const GET_TRANSFERS_QUERY = `
  query GetTransfers($first: Int!, $skipCitizen: Int!, $skipTeam: Int!) {
    moonDAOCitizenTransfers(first: $first, skip: $skipCitizen, orderBy: blockTimestamp, orderDirection: desc) {
      id
      tokenId
      transactionHash
      ethValue
      blockTimestamp
      blockNumber
    }
    moonDAOTeamTransfers(first: $first, skip: $skipTeam, orderBy: blockTimestamp, orderDirection: desc) {
      id
      ethValue
      tokenId
      blockTimestamp
      blockNumber
    }
  }
`

export async function getAllNetworkTransfers(
  batchSize: number = 1000
): Promise<AllTransfersResult> {
  const allCitizenTransfers: CitizenTransfer[] = []
  const allTeamTransfers: TeamTransfer[] = []

  let citizenSkip = 0
  let teamSkip = 0
  let citizenHasMore = true
  let teamHasMore = true

  while (citizenHasMore || teamHasMore) {
    try {
      const result = await subgraphClient
        .query(GET_TRANSFERS_QUERY, {
          first: batchSize,
          skipCitizen: citizenHasMore ? citizenSkip : 0,
          skipTeam: teamHasMore ? teamSkip : 0,
        })
        .toPromise()

      if (result.error) {
        throw new Error(`Subgraph query error: ${result.error.message}`)
      }

      const { moonDAOCitizenTransfers, moonDAOTeamTransfers } = result.data

      // Handle citizen transfers
      if (citizenHasMore) {
        if (moonDAOCitizenTransfers.length > 0) {
          allCitizenTransfers.push(...moonDAOCitizenTransfers)
          citizenSkip += moonDAOCitizenTransfers.length

          // If we got less than the batch size, we've reached the end
          if (moonDAOCitizenTransfers.length < batchSize) {
            citizenHasMore = false
          }
        } else {
          citizenHasMore = false
        }
      }

      // Handle team transfers
      if (teamHasMore) {
        if (moonDAOTeamTransfers.length > 0) {
          allTeamTransfers.push(...moonDAOTeamTransfers)
          teamSkip += moonDAOTeamTransfers.length

          // If we got less than the batch size, we've reached the end
          if (moonDAOTeamTransfers.length < batchSize) {
            teamHasMore = false
          }
        } else {
          teamHasMore = false
        }
      }

      // Add a small delay to avoid overwhelming the subgraph
      if (citizenHasMore || teamHasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error('Error fetching transfers:', error)
      throw error
    }
  }

  return {
    citizenTransfers: allCitizenTransfers,
    teamTransfers: allTeamTransfers,
  }
}

export async function getNetworkTransfersBatch(
  first: number = 10,
  skipCitizen: number = 0,
  skipTeam: number = 0
): Promise<AllTransfersResult> {
  try {
    const result = await subgraphClient
      .query(GET_TRANSFERS_QUERY, {
        first,
        skipCitizen,
        skipTeam,
      })
      .toPromise()

    if (result.error) {
      throw new Error(`Subgraph query error: ${result.error.message}`)
    }

    return {
      citizenTransfers: result.data.moonDAOCitizenTransfers,
      teamTransfers: result.data.moonDAOTeamTransfers,
    }
  } catch (error) {
    console.error('Error fetching transfer batch:', error)
    throw error
  }
}

export { subgraphClient }
