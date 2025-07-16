import { NextApiRequest, NextApiResponse } from 'next'

interface QuoteRequest {
  app_id: string
  amount_fiat: string
  fiat_currency: string
  crypto_asset: string
  network: string
  destination_address: string
}

interface CoinbaseQuoteResponse {
  quote_id: string
  total_amount: string
  crypto_amount: string
  fees: {
    coinbase_fee: string
    network_fee: string
  }
  expires_at: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      app_id,
      amount_fiat,
      fiat_currency,
      crypto_asset,
      network,
      destination_address,
    }: QuoteRequest = req.body

    // Validate required fields
    if (!app_id || !amount_fiat || !crypto_asset || !destination_address) {
      return res.status(400).json({
        error:
          'Missing required fields: app_id, amount_fiat, crypto_asset, destination_address',
      })
    }

    // Validate amount
    const amount = parseFloat(amount_fiat)
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // Call Coinbase Buy Quote API
    const coinbaseResponse = await fetch(
      'https://api.coinbase.com/v2/exchange-rates',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.COINBASE_API_KEY}`,
          'Content-Type': 'application/json',
          'CB-VERSION': '2023-05-15',
        },
      }
    )

    if (!coinbaseResponse.ok) {
      throw new Error(`Coinbase API error: ${coinbaseResponse.statusText}`)
    }

    const ratesData = await coinbaseResponse.json()

    // Get exchange rate for the crypto asset
    const rate = ratesData.data.rates[crypto_asset]
    if (!rate) {
      return res
        .status(400)
        .json({ error: `Unsupported crypto asset: ${crypto_asset}` })
    }

    // Calculate crypto amount and fees
    const cryptoRate = 1 / parseFloat(rate)
    const coinbaseFee = amount * 0.015 // 1.5% fee
    const networkFee =
      crypto_asset === 'ETH' ? 5 : crypto_asset === 'BTC' ? 3 : 1
    const totalAmount = amount + coinbaseFee + networkFee
    const cryptoAmount = (amount - networkFee) * cryptoRate

    // Generate a quote ID (in production, this would come from Coinbase)
    const quoteId = `quote_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`

    const quote: CoinbaseQuoteResponse = {
      quote_id: quoteId,
      total_amount: totalAmount.toFixed(2),
      crypto_amount: cryptoAmount.toFixed(8),
      fees: {
        coinbase_fee: coinbaseFee.toFixed(2),
        network_fee: networkFee.toFixed(2),
      },
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    }

    res.status(200).json(quote)
  } catch (error) {
    console.error('Coinbase quote error:', error)
    res.status(500).json({
      error: 'Failed to get quote',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
