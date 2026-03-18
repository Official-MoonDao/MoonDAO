import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getUserMemberships } from '@/lib/hats/getUserMemberships'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chainId = parseInt(req.query.chainId as string)
  const wearerAddress = req.query.wearerAddress as string

  if (!chainId || !wearerAddress || !wearerAddress.startsWith('0x')) {
    return res.status(400).json({
      error: 'chainId and wearerAddress (0x...) are required',
    })
  }

  setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, chainId, wearerAddress')

  try {
    const memberships = await getUserMemberships(chainId, wearerAddress)
    res.status(200).json(memberships)
  } catch (err: any) {
    console.error('[user-memberships] Error:', err?.message)
    res.status(500).json({
      error: 'Failed to fetch user memberships',
    })
  }
}

export default withMiddleware(handler, rateLimit)
