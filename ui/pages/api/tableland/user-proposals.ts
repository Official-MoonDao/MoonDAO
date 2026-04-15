import { DEFAULT_CHAIN_V5 } from 'const/config'
import { PROJECT_TABLE_NAMES } from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Simple in-memory cache for IPFS author lookups (MDP -> authorAddress)
const authorCache = new Map<number, { author: string; name: string; active: number; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { address } = req.query
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address parameter is required' })
  }

  const authorLower = address.toLowerCase()
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const tableName = PROJECT_TABLE_NAMES[chainSlug]

  if (!tableName) {
    return res.status(400).json({ error: 'No project table for this chain' })
  }

  // Cache response for 30s at CDN
  setCDNCacheHeaders(res, 30, 60, 'Accept-Encoding, address')

  try {
    // Fetch all projects from Tableland
    const statement = `SELECT id, MDP, name, proposalIPFS, active FROM ${tableName} ORDER BY MDP DESC`
    const projects = await queryTable(chain, statement)

    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(200).json([])
    }

    const now = Date.now()
    const results: Array<{
      uuid: string
      title: string
      proposalId: number
      status: string
      MDP: number
    }> = []

    // Check each project for author match
    const fetchPromises = projects.map(async (project: any) => {
      const mdp = project.MDP as number

      // Check cache first
      const cached = authorCache.get(mdp)
      if (cached && now - cached.ts < CACHE_TTL) {
        if (cached.author.toLowerCase() === authorLower) {
          return {
            uuid: String(project.id),
            title: cached.name || project.name || `Project #${project.id}`,
            proposalId: mdp,
            status: project.active === 2 ? 'Approved' : 'Discussion',
            MDP: mdp,
          }
        }
        return null
      }

      // Fetch IPFS data
      if (!project.proposalIPFS) return null
      try {
        const ipfsRes = await fetch(project.proposalIPFS, {
          signal: AbortSignal.timeout(5000),
        })
        if (!ipfsRes.ok) return null
        const data = await ipfsRes.json()
        const ipfsAuthor = data.authorAddress || ''

        // Cache the result
        authorCache.set(mdp, {
          author: ipfsAuthor,
          name: data.title || project.name || '',
          active: project.active,
          ts: now,
        })

        if (ipfsAuthor.toLowerCase() === authorLower) {
          return {
            uuid: String(project.id),
            title: data.title || project.name || `Project #${project.id}`,
            proposalId: mdp,
            status: project.active === 2 ? 'Approved' : 'Discussion',
            MDP: mdp,
          }
        }
      } catch {
        // Skip failed IPFS fetches
      }
      return null
    })

    const settled = await Promise.allSettled(fetchPromises)
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }

    return res.status(200).json(results)
  } catch (error) {
    console.error('Error fetching user proposals:', error)
    return res.status(500).json({ error: 'Failed to fetch user proposals' })
  }
}

export default withMiddleware(handler, rateLimit)
