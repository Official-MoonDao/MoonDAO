/**
 * Centralized Team Data Service
 *
 * Single source of truth for fetching and validating team data with owner information.
 * Uses batched RPC calls to efficiently fetch owner addresses and avoid rate limiting.
 */
import TeamABI from 'const/abis/Team.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import { TEAM_ADDRESSES, TEAM_TABLE_NAMES, TEAM_TABLE_ADDRESSES } from 'const/config'
import { BLOCKED_TEAMS } from 'const/whitelist'
import { Chain, getContract, NFT, readContract } from 'thirdweb'
import { TeamRow, teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

export type TeamWithOwner = NFT & {
  owner: string
}

/**
 * Batch fetch team owners using Engine API
 */
export async function batchFetchTeamOwners(
  teamIds: Array<string | number>,
  teamContractAddress: string,
  chainId: number,
  options: {
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<string | number, string>> {
  const { onProgress } = options
  const resultMap = new Map<string | number, string>()

  if (teamIds.length === 0) {
    return resultMap
  }

  try {
    onProgress?.(0, teamIds.length)

    const { engineBatchRead } = await import('@/lib/thirdweb/engine')
    const results = await engineBatchRead<string>(
      teamContractAddress,
      'ownerOf',
      teamIds.map((id) => [id]),
      TeamABI,
      chainId
    )

    results.forEach((ownerAddress, index) => {
      const id = teamIds[index]
      resultMap.set(id, ownerAddress)
    })

    onProgress?.(teamIds.length, teamIds.length)
  } catch (error) {
    console.error('Failed to batch fetch team owners:', error)
  }

  return resultMap
}

/**
 * Fetch all teams with owner data efficiently
 */
export async function fetchTeamsWithOwners(
  chain: Chain,
  options: {
    onProgress?: (step: string, completed: number, total: number) => void
    limit?: number
  } = {}
): Promise<TeamWithOwner[]> {
  const { onProgress, limit } = options

  try {
    const chainSlug = getChainSlug(chain)

    onProgress?.('Fetching team table name', 0, 4)

    let teamTableName = TEAM_TABLE_NAMES[chainSlug]
    if (!teamTableName && TEAM_TABLE_ADDRESSES[chainSlug]) {
      const teamTableContract = getContract({
        client: serverClient,
        address: TEAM_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: TeamTableABI as any,
      })
      teamTableName = (await readContract({
        contract: teamTableContract,
        method: 'getTableName',
      })) as string
    }

    if (!teamTableName) {
      console.error('Team table name not found')
      return []
    }

    onProgress?.('Querying team table', 1, 4)

    const limitClause = limit ? ` LIMIT ${limit}` : ''
    const teamStatement = `SELECT * FROM ${teamTableName} ORDER BY id DESC${limitClause}`
    const teamRows: any = await queryTable(chain, teamStatement)

    if (!teamRows || teamRows.length === 0) {
      return []
    }

    onProgress?.('Converting team data', 2, 4)

    const teams: NFT[] = []
    for (const row of teamRows) {
      if (!BLOCKED_TEAMS.has(row.id)) {
        try {
          teams.push(teamRowToNFT(row as TeamRow))
        } catch (error) {
          console.error(`Failed to convert team row ${row.id}:`, error)
        }
      }
    }

    if (teams.length === 0) {
      return []
    }

    onProgress?.('Fetching team owners', 3, 4)

    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
      chain,
    })

    const teamIds = teams.map((t: any) => t.metadata.id)
    const ownerResults = await batchFetchTeamOwners(teamIds, teamContract.address, chain.id, {
      onProgress: (completed, total) => {
        onProgress?.('Fetching team owners', 3, 4)
      },
    })

    onProgress?.('Processing results', 4, 4)

    const teamsWithOwners: TeamWithOwner[] = teams.map((team: any) => {
      const teamId = team.metadata.id
      const owner = ownerResults.get(teamId) || ''

      return {
        ...team,
        owner,
      } as TeamWithOwner
    })

    return teamsWithOwners
  } catch (error) {
    console.error('Error fetching teams with owners:', error)
    return []
  }
}

/**
 * Fetch a single team with owner data
 */
export async function fetchTeamWithOwner(
  chain: Chain,
  teamId: string | number
): Promise<TeamWithOwner | null> {
  const chainSlug = getChainSlug(chain)

  try {
    let teamTableName = TEAM_TABLE_NAMES[chainSlug]
    if (!teamTableName && TEAM_TABLE_ADDRESSES[chainSlug]) {
      const teamTableContract = getContract({
        client: serverClient,
        address: TEAM_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: TeamTableABI as any,
      })
      teamTableName = (await readContract({
        contract: teamTableContract,
        method: 'getTableName',
      })) as string
    }

    if (!teamTableName) {
      return null
    }

    const teamStatement = `SELECT * FROM ${teamTableName} WHERE id = ${teamId}`
    const teamRows: any = await queryTable(chain, teamStatement)

    if (!teamRows || teamRows.length === 0 || BLOCKED_TEAMS.has(Number(teamId))) {
      return null
    }

    const team = teamRowToNFT(teamRows[0] as TeamRow)

    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
      chain,
    })

    const owner = await readContract({
      contract: teamContract,
      method: 'ownerOf',
      params: [teamId],
    })

    return {
      ...team,
      owner: owner as string,
    } as TeamWithOwner
  } catch (error) {
    console.error(`Error fetching team ${teamId}:`, error)
    return null
  }
}

/**
 * Get dummy data for development/testing
 */
export function getDummyTeamData(): TeamWithOwner[] {
  return [
    {
      id: BigInt(1),
      metadata: {
        id: '1',
        uri: '',
        name: 'Test Team',
        description: 'A test team for development',
        image: '/assets/citizen-default.png',
        animation_url: '',
        external_url: '',
        attributes: [
          { trait_type: 'website', value: '' },
          { trait_type: 'communications', value: '' },
          { trait_type: 'view', value: 'public' },
          { trait_type: 'formId', value: '' },
        ] as unknown as Record<string, unknown>,
      },
      owner: '0x0000000000000000000000000000000000000000',
      tokenURI: '',
      type: 'ERC721',
    } as any as TeamWithOwner,
  ]
}
