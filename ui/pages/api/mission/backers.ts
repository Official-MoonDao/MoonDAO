import MissionTableABI from 'const/abis/MissionTable.json'
import {
  DEFAULT_CHAIN_V5,
  MISSION_TABLE_ADDRESSES,
  MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract } from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

type Backer = {
  id: string
  backer: string
  projectId: string
  totalAmountContributed: string
  numberOfPayments: number
  firstContributionTimestamp: string
  lastContributionTimestamp: string
}

const subgraphClient = createClient({
  url: MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { missionId, projectId } = req.query

  if (!missionId && !projectId) {
    return res
      .status(400)
      .json({ error: 'Mission ID or Project ID is required' })
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
    return subgraphRes.data.backers
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

    res.status(200).json({ backers: allBackers })
  } catch (error) {
    console.error('Subgraph query error:', error)
    res.status(500).json({ error: 'Failed to fetch subgraph data' })
  }
}

export default withMiddleware(handler, rateLimit)
