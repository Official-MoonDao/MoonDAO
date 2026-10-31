import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { cctpForwardFeeUrl, selectFastForwardTier } from '@/lib/bridge/usdcCctp'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Fees move with destination gas. Keep the response uncached so a burn
  // uses the quote Circle is enforcing right now.
  setCDNCacheHeaders(res, 0, 0)
  res.setHeader('Cache-Control', 'no-store')

  try {
    const feeResponse = await fetch(cctpForwardFeeUrl(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!feeResponse.ok) {
      return res.status(502).json({ error: 'USDC bridge fee is unavailable' })
    }
    const tier = selectFastForwardTier(await feeResponse.json())
    if (!tier) {
      return res.status(502).json({ error: 'USDC bridge fee is unavailable' })
    }
    return res.status(200).json({
      finalityThreshold: tier.finalityThreshold,
      minimumFee: tier.minimumFeeBps,
      forwardFee: {
        low: tier.forwardFee.low.toString(),
        med: tier.forwardFee.med.toString(),
        high: tier.forwardFee.high.toString(),
      },
    })
  } catch (err) {
    console.error('USDC bridge fee lookup failed', err)
    return res.status(502).json({ error: 'USDC bridge fee is unavailable' })
  }
}

export default withMiddleware(handler, rateLimit)
