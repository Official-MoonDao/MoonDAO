import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'

/**
 * GET /api/voting-power?addresses=0x1,0x2,0x3
 * Returns voting power for each address using the same calculation as project votes:
 * sqrt(total vMOONEY balance across all chains)
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const addressesParam = req.query.addresses
  if (!addressesParam || typeof addressesParam !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid addresses parameter' })
  }

  const addresses = addressesParam.split(',').map((a) => a.trim())
  if (addresses.length === 0 || addresses.length > 100) {
    return res.status(400).json({ error: 'Addresses must be 1-100 comma-separated addresses' })
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const vMOONEYs = await fetchTotalVMOONEYs(addresses, currentTimestamp)
    const votingPowers = vMOONEYs.map((v) => Math.sqrt(v))
    return res.status(200).json({ votingPowers })
  } catch (error) {
    console.error('Error fetching voting power:', error)
    return res.status(500).json({ error: 'Failed to fetch voting power' })
  }
}

export default withMiddleware(handler, rateLimit)
