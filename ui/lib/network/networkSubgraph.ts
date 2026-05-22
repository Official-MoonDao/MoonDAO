import { MOONDAO_NETWORK_SUBGRAPH_URL, CITIZEN_ADDRESSES, TEAM_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
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
    citizenTransfers:
      allCitizenTransfers.length < 148 ? [] : allCitizenTransfers,
    teamTransfers: allTeamTransfers.length < 18 ? [] : allTeamTransfers,
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

/**
 * Fetch recent citizen mint transfers via Etherscan v2 (Arbitrum).
 * Used to attach real mintTimestamps to newestCitizens on the dashboard.
 */
export async function getRecentCitizenTransfers(limit: number = 50): Promise<CitizenTransfer[]> {
  try {
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const CITIZEN_ADDRESS = CITIZEN_ADDRESSES[chainSlug]
    if (!CITIZEN_ADDRESS) return []
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
    if (!apiKey) return []
    const res = await fetch(
      `https://api.etherscan.io/v2/api?module=account&action=tokennfttx` +
      `&contractaddress=${CITIZEN_ADDRESS}&page=1&offset=${limit}&sort=desc&chainid=${DEFAULT_CHAIN_V5.id}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    if (json.status !== '1' || !Array.isArray(json.result)) return []
    return json.result
      .filter((tx: any) => tx.from === '0x0000000000000000000000000000000000000000')
      .map((tx: any) => ({
        id: tx.hash,
        tokenId: tx.tokenID,
        transactionHash: tx.hash,
        ethValue: '0',
        blockTimestamp: tx.timeStamp,
        blockNumber: tx.blockNumber,
      }))
  } catch {
    return []
  }
}

/**
 * Fetch recent team mint transfers via Etherscan v2 (Arbitrum).
 * Used to attach real mintTimestamps to newestTeams on the dashboard.
 */
export async function getRecentTeamTransfers(limit: number = 20): Promise<TeamTransfer[]> {
  try {
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const TEAM_ADDRESS = TEAM_ADDRESSES[chainSlug]
    if (!TEAM_ADDRESS) return []
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
    if (!apiKey) return []
    const res = await fetch(
      `https://api.etherscan.io/v2/api?module=account&action=tokennfttx` +
      `&contractaddress=${TEAM_ADDRESS}&page=1&offset=${limit}&sort=desc&chainid=${DEFAULT_CHAIN_V5.id}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    if (json.status !== '1' || !Array.isArray(json.result)) return []
    return json.result
      .filter((tx: any) => tx.from === '0x0000000000000000000000000000000000000000')
      .map((tx: any) => ({
        id: tx.hash,
        tokenId: tx.tokenID,
        ethValue: '0',
        blockTimestamp: tx.timeStamp,
        blockNumber: tx.blockNumber,
      }))
  } catch {
    return []
  }
}
