import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

let priceCache: {
  data: any
  timestamp: number
} | null = null

const CACHE_DURATION = 60 * 1000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    if (priceCache && now - priceCache.timestamp < CACHE_DURATION) {
      return res.status(200).json(priceCache.data)
    }

    const ethPrice = await fetch(
      `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chaindId=1&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    )

    const ethPriceData = await ethPrice.json()

    priceCache = {
      data: ethPriceData,
      timestamp: now,
    }

    res.status(200).json(ethPriceData)
  } catch (error) {
    console.error('Etherscan API error:', error)
    res.status(500).json({ error: 'Failed to fetch current ETH price' })
  }
}

export default withMiddleware(handler, rateLimit)
