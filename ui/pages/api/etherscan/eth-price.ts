import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding')

    const ethPrice = await fetch(
      `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chainid=1&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    )

    const ethPriceData = await ethPrice.json()

    res.status(200).json(ethPriceData)
  } catch (error) {
    console.error('Etherscan API error:', error)
    res.status(500).json({ error: 'Failed to fetch current ETH price' })
  }
}

export default withMiddleware(handler, rateLimit)
