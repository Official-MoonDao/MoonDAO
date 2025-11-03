import MissionTableABI from 'const/abis/MissionTable.json'
import { DEFAULT_CHAIN_V5, MISSION_TABLE_ADDRESSES } from 'const/config'
import { MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL } from 'const/config'
import { readContract } from 'thirdweb'
import { createClient } from 'urql'
import { cacheExchange, fetchExchange } from 'urql'
import queryTable from '../tableland/queryTable'
import { getChainSlug } from '../thirdweb/chain'
import { serverClient } from '../thirdweb/client'

const subgraphClient = createClient({
  url: MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

type Backer = {
  id: string
  backer: string
  projectId: string
  totalAmountContributed: string
  numberOfPayments: number
  firstContributionTimestamp: string
  lastContributionTimestamp: string
}

type CachedBackers = {
  data: Backer[]
  timestamp: number
}

const backersCache: Map<string, CachedBackers> = new Map()
const CACHE_TTL = 30 * 1000 // 30 seconds

function getBackersCacheKey(projectId: any, missionId?: any): string {
  return `${projectId || 'null'}_${missionId || 'null'}`
}

export async function getBackers(projectId: any, missionId?: any) {
  // Check cache first
  const cacheKey = getBackersCacheKey(projectId, missionId)
  const now = Date.now()
  const cached = backersCache.get(cacheKey)

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  if (!missionId && !projectId) {
    throw new Error('Mission ID or Project ID is required')
  }

  let pid = projectId
  if (!pid) {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      abi: MissionTableABI,
    })
    const missionTableName = await readContract({
      contract: missionTableContract,
      method: 'getTableName' as string,
      params: [],
    })
    const statement = `SELECT projectId FROM ${missionTableName} WHERE id = ${missionId}`
    const rows: any = await queryTable(chain, statement)
    pid = rows[0]?.projectId
  }

  const BATCH_SIZE = 1000

  const fetchBackersBatch = async (skip: number) => {
    const query = `
      query {
        backers(first: ${BATCH_SIZE}, skip: ${skip}, where: {projectId: ${pid}}) {
          id
          backer
          projectId
          totalAmountContributed
          numberOfPayments
          firstContributionTimestamp
          lastContributionTimestamp
        }
      }
    `
    const subgraphRes = await subgraphClient.query(query, {}).toPromise()
    if (subgraphRes.error) {
      throw new Error(subgraphRes.error.message)
    }
    return subgraphRes.data?.backers || []
  }

  try {
    let allBackers: Backer[] = []
    let skip = 0
    let hasMore = true

    while (hasMore) {
      const batch = await fetchBackersBatch(skip)
      allBackers = [...allBackers, ...batch]

      if (batch.length < BATCH_SIZE) {
        hasMore = false
      } else {
        skip += BATCH_SIZE
      }
    }

    // Cache the result before returning
    backersCache.set(cacheKey, {
      data: allBackers,
      timestamp: now,
    })

    return allBackers
  } catch (error) {
    console.error('Failed to fetch backers:', error)
    throw new Error('Failed to fetch subgraph data')
  }
}

export function formatContributionOutput(output: number) {
  if (!Number.isFinite(output) || output <= 0) return 0

  if (output >= 1) {
    return Math.floor(output).toLocaleString()
  }
  if (output < 0.01) {
    return (Math.floor(output * 1000) / 1000).toFixed(3).toString()
  }
  if (output < 0.1) {
    return (Math.floor(output * 100) / 100).toFixed(2).toString()
  }

  return (Math.floor(output * 10) / 10).toFixed(1).toString()
}
