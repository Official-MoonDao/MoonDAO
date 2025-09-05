import { DEFAULT_CHAIN_V5, CITIZEN_TABLE_NAMES } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q: query } = req.query

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required' })
  }

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const tableName = CITIZEN_TABLE_NAMES[chainSlug]

    // Search by name (case insensitive) or token ID
    const statement = `SELECT id, name, owner FROM ${tableName} WHERE LOWER(name) LIKE LOWER('%${query}%') OR id = '${query}' ORDER BY name ASC LIMIT 20`

    const results = await queryTable(chain, statement)

    if (!results) {
      return res.status(500).json({ message: 'Error querying citizen table' })
    }

    // Format results for the frontend
    const citizens = results.map((citizen: any) => ({
      id: citizen.id,
      name: citizen.name,
      owner: citizen.owner,
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
