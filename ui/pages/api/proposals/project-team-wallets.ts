/**
 * Manager- and member-hat wearers for each requested project.
 *
 * The Member Vote distribute UI uses this to lock a voter out of projects
 * whose team they're on. The tally strips those allocations regardless
 * (see `lib/proposals/selfVoteExclusions.ts`); this just makes the rule
 * visible before they submit.
 *
 * GET `?projectIds=1,2,3` → `{ wallets: { [projectId]: string[] } }`.
 */
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { fetchProjectTeamWallets } from '@/lib/project/projectTeamWallets'

const MAX_PROJECT_IDS = 50

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const projectIds = String(req.query.projectIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id))
  if (projectIds.length === 0 || projectIds.length > MAX_PROJECT_IDS) {
    return res
      .status(400)
      .json({ error: `projectIds must list 1-${MAX_PROJECT_IDS} numeric ids` })
  }

  try {
    const { wallets } = await fetchProjectTeamWallets(DEFAULT_CHAIN_V5, projectIds)
    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding')
    return res.status(200).json({ wallets })
  } catch (error: any) {
    console.error('[project-team-wallets]', error)
    return res.status(500).json({ error: 'Failed to load project teams' })
  }
}

export default withMiddleware(handler, rateLimit)
