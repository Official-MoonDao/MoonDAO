import {
  BENDYSTRAW_JB_VERSION,
  DEFAULT_CHAIN_V5,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

const SUBGRAPH_URL = `https://${
  process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
}bendystraw.xyz/${process.env.BENDYSTRAW_API_KEY}/graphql`

export type RecentDonation = {
  projectId: string
  missionId: string
  missionName: string
  missionImage?: string
  from: string
  amountWei: string
  timestamp: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const tableName = MISSION_TABLE_NAMES[chainSlug]

    // Fetch all missions from Tableland
    const missionRows: any[] = await queryTable(chain, `SELECT id, projectId, teamId FROM ${tableName}`)

    // Build a map from projectId → mission row
    const projectIdToMission = new Map<number, any>()
    for (const row of missionRows) {
      if (row.projectId) projectIdToMission.set(Number(row.projectId), row)
    }

    const projectIds = [...projectIdToMission.keys()].filter(Boolean)
    if (projectIds.length === 0) {
      return res.status(200).json({ donations: [] })
    }

    // Query recent pay events for all mission project IDs
    const query = `
      query {
        payEvents(
          where: {
            projectId_in: [${projectIds.join(',')}]
            version: ${BENDYSTRAW_JB_VERSION}
            chainId: ${chain.id}
          }
          orderBy: "timestamp"
          orderDirection: "desc"
          limit: 20
        ) {
          items {
            projectId
            from
            beneficiary
            amount
            timestamp
            memo
          }
        }
      }
    `

    const subgraphRes = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!subgraphRes.ok) {
      return res.status(200).json({ donations: [] })
    }

    const { data } = await subgraphRes.json()
    const payEvents: any[] = data?.payEvents?.items ?? []

    // Fetch mission metadata (name/image) from IPFS via the controller — too slow for here.
    // Instead we'll return what we have and let the client enrich with mission name from prop.
    const donations: RecentDonation[] = payEvents.map((ev) => {
      const mission = projectIdToMission.get(Number(ev.projectId))
      return {
        projectId: String(ev.projectId),
        missionId: String(mission?.id ?? ''),
        missionName: '',
        from: ev.from ?? ev.beneficiary ?? '',
        amountWei: String(ev.amount ?? '0'),
        timestamp: Number(ev.timestamp) * 1000,
      }
    })

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res.status(200).json({ donations })
  } catch (err) {
    console.error('[recent-donations]', err)
    return res.status(200).json({ donations: [] })
  }
}
