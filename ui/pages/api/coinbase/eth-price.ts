import type { NextApiRequest, NextApiResponse } from 'next'

interface CoinbaseSpotPriceResponse {
  data: {
    base: string
    currency: string
    amount: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Use Coinbase's spot price endpoint (market price without fees)
    // This matches what their quote API uses for calculations
    const response = await fetch(
      'https://api.coinbase.com/v2/prices/ETH-USD/spot',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`)
    }

    const data: CoinbaseSpotPriceResponse = await response.json()

    return res.status(200).json({
      price: parseFloat(data.data.amount),
      currency: data.data.currency,
      base: data.data.base,
    })
  } catch (error: any) {
    console.error('Error fetching Coinbase ETH price:', error)
    return res.status(500).json({
      error: 'Failed to fetch ETH price',
      details: error.message,
    })
  }
}
