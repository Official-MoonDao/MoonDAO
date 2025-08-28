import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

let priceCache: {
  data: any
  timestamp: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    if (priceCache && now - priceCache.timestamp < CACHE_DURATION) {
      return res.status(200).json(priceCache.data)
    }

    const response = await fetch(
      'https://openapiv1.coinstats.app/coins?currency=USD&symbol=MOONEY&blockchains=ethereum&limit=1',
      {
        method: 'GET',
        headers: {
          'X-API-KEY': process.env.COINSTATS_API_KEY || '',
          accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `CoinStats API error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    if (data.result && data.result.length > 0) {
      const mooneyData = data.result[0]
      const result = {
        price: mooneyData.price || 0,
        priceChange24h: mooneyData.priceChange1d || 0,
        symbol: mooneyData.symbol,
        name: mooneyData.name,
      }

      priceCache = {
        data: { result },
        timestamp: now,
      }

      res.status(200).json({ result })
    } else {
      throw new Error('No MOONEY price data found')
    }
  } catch (error) {
    console.error('MOONEY price API error:', error)
    res.status(500).json({ error: 'Failed to fetch MOONEY price' })
  }
}

export default withMiddleware(handler, rateLimit)
