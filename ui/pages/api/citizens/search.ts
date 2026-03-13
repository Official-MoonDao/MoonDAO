import {
  DEFAULT_CHAIN_V5,
  CITIZEN_TABLE_NAMES,
  OVERVIEW_BLOCKED_CITIZEN_IDS,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { sanitizeSearchQuery } from '@/lib/overview-delegate/leaderboard'
import { arbitrum } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

const SUPPORTED_CHAINS: Record<string, typeof arbitrum> = {
  arbitrum,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q: query, chain: chainParam } = req.query

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required' })
  }

  try {
    const chain =
      typeof chainParam === 'string' && SUPPORTED_CHAINS[chainParam]
        ? SUPPORTED_CHAINS[chainParam]
        : DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const tableName = CITIZEN_TABLE_NAMES[chainSlug]

    const sanitized = sanitizeSearchQuery(query)
    const isNumeric = /^\d+$/.test(sanitized)

    const excludeIds =
      OVERVIEW_BLOCKED_CITIZEN_IDS.length > 0
        ? `id NOT IN (${OVERVIEW_BLOCKED_CITIZEN_IDS.join(',')})`
        : '1=1'

    let searchClause: string
    if (isNumeric) {
      searchClause = `LOWER(name) LIKE LOWER('%${sanitized}%') OR id = ${parseInt(sanitized, 10)}`
    } else {
      searchClause = `LOWER(name) LIKE LOWER('%${sanitized}%')`
    }

    const statement = `SELECT id, name, owner, image FROM ${tableName} WHERE (${searchClause}) AND ${excludeIds} ORDER BY name ASC LIMIT 20`

    const results = await queryTable(chain, statement)

    if (!results) {
      return res.status(500).json({ message: 'Error querying citizen table' })
    }

    const citizens = results.map((citizen: any) => ({
      id: citizen.id,
      name: citizen.name,
      owner: citizen.owner,
      image: citizen.image || null,
      displayName: citizen.name
        ? `${citizen.name} (#${citizen.id})`
        : `Citizen #${citizen.id}`,
    }))

    return res.status(200).json({ citizens })
  } catch (error) {
    console.error('Error searching citizens:', error)
    return res.status(500).json({ message: 'Error searching citizens' })
  }
}

export default withMiddleware(handler, rateLimit)
