import { utils as ethersUtils } from 'ethers'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { fetchVotesCount } from '@/lib/xp/votes'

// Public, read-only endpoint that returns the canonical vote count for an
// address (on-chain governance + legacy Snapshot). Used by the Citizen profile
// so its "Votes" stat matches the "Votes" XP quest exactly. No auth required
// because it only exposes already-public governance participation data.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET')
      return res.status(405).json({ error: 'Method not allowed' })

    const address = req.query.address as string

    if (!address || !ethersUtils.isAddress(address))
      return res.status(400).json({ error: 'Invalid address' })

    const votesCount = await fetchVotesCount(address as Address)

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ votesCount })
  } catch (err: any) {
    console.error('votes-count error:', err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler)
