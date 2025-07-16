import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

interface PurchaseRequest {
  app_id: string
  quote_id: string
  payment_method: 'apple_pay' | 'google_pay'
  payment_data: {
    apple_pay_token?: any
    google_pay_token?: any
    billing_contact?: any
    email?: string
  }
  destination_address: string
}

interface CoinbasePurchaseResponse {
  purchase_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transaction_hash?: string
  estimated_delivery: string
  crypto_amount: string
  crypto_asset: string
  network: string
  tracking_url?: string
}

// Validate Ethereum address
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Create signature for Coinbase API authentication
function createCoinbaseSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ''
): string {
  const crypto = require('crypto')
  const message = timestamp + method.toUpperCase() + requestPath + body
  return crypto
    .createHmac('sha256', process.env.COINBASE_API_SECRET!)
    .update(message)
    .digest('hex')
}

// Make authenticated request to Coinbase API
async function coinbaseApiRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const bodyString = body ? JSON.stringify(body) : ''
  const signature = createCoinbaseSignature(timestamp, method, path, bodyString)

  const response = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      'CB-ACCESS-KEY': process.env.COINBASE_API_KEY!,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-VERSION': '2023-05-15',
      'Content-Type': 'application/json',
    },
    body: bodyString || undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Coinbase API error: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  return response.json()
}

// Execute purchase through Coinbase Fiat Onramp
async function executeCoinbaseFiatPurchase(
  request: PurchaseRequest
): Promise<CoinbasePurchaseResponse> {
  try {
    // Coinbase Fiat Onramp API endpoint for creating purchases
    const purchaseData = {
      app_id: request.app_id,
      quote_id: request.quote_id,
      payment_method: request.payment_method,
      payment_data: request.payment_data,
      destination_wallet: {
        address: request.destination_address,
        // Coinbase will auto-detect network based on address format
      },
      user_data: {
        email: request.payment_data.email,
        billing_contact: request.payment_data.billing_contact,
      },
    }

    console.log('Creating Coinbase fiat purchase:', {
      app_id: request.app_id,
      quote_id: request.quote_id,
      payment_method: request.payment_method,
      destination_address: request.destination_address,
    })

    // Call Coinbase Fiat Onramp API
    const response = await coinbaseApiRequest(
      'POST',
      '/onramp/v1/purchases',
      purchaseData
    )

    return {
      purchase_id: response.id,
      status: response.status,
      transaction_hash: response.transaction_hash,
      estimated_delivery:
        response.estimated_delivery ||
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      crypto_amount: response.crypto_amount,
      crypto_asset: response.crypto_asset,
      network: response.network,
      tracking_url:
        response.tracking_url ||
        `https://commerce.coinbase.com/charges/${response.id}`,
    }
  } catch (error) {
    console.error('Coinbase fiat purchase error:', error)
    throw error
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify required environment variables
  if (!process.env.COINBASE_API_KEY || !process.env.COINBASE_API_SECRET) {
    console.error('Missing required Coinbase API credentials')
    return res.status(500).json({
      error: 'Server configuration error',
    })
  }

  try {
    const {
      app_id,
      quote_id,
      payment_method,
      payment_data,
      destination_address,
    }: PurchaseRequest = req.body

    // Validate required fields
    if (
      !app_id ||
      !quote_id ||
      !payment_method ||
      !payment_data ||
      !destination_address
    ) {
      return res.status(400).json({
        error:
          'Missing required fields: app_id, quote_id, payment_method, payment_data, destination_address',
      })
    }

    // Validate payment method
    if (payment_method !== 'apple_pay' && payment_method !== 'google_pay') {
      return res.status(400).json({
        error: 'Only Apple Pay and Google Pay are supported',
      })
    }

    // Validate destination address (basic Ethereum validation)
    if (!isValidEthereumAddress(destination_address)) {
      return res.status(400).json({
        error: 'Invalid Ethereum address format',
      })
    }

    // Validate payment token based on method
    if (payment_method === 'apple_pay' && !payment_data.apple_pay_token) {
      return res.status(400).json({
        error: 'Missing Apple Pay token',
      })
    }

    if (payment_method === 'google_pay' && !payment_data.google_pay_token) {
      return res.status(400).json({
        error: 'Missing Google Pay token',
      })
    }

    // Log request for monitoring (remove sensitive data in production logs)
    console.log(`Processing ${payment_method} purchase:`, {
      app_id,
      quote_id,
      destination_address,
      has_payment_token:
        payment_method === 'apple_pay'
          ? !!payment_data.apple_pay_token
          : !!payment_data.google_pay_token,
      user_email: payment_data.email,
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    })

    // Execute purchase through Coinbase Fiat Onramp
    const purchase = await executeCoinbaseFiatPurchase({
      app_id,
      quote_id,
      payment_method,
      payment_data,
      destination_address,
    })

    // Log successful purchase
    console.log('Coinbase fiat purchase completed:', {
      purchase_id: purchase.purchase_id,
      status: purchase.status,
      crypto_amount: purchase.crypto_amount,
      crypto_asset: purchase.crypto_asset,
      destination_address,
    })

    res.status(200).json(purchase)
  } catch (error) {
    console.error('Purchase API error:', error)

    // Handle specific Coinbase API errors
    if (error instanceof Error) {
      if (error.message.includes('quote')) {
        return res.status(400).json({
          error: 'Invalid or expired quote',
          details: 'Please request a new quote and try again',
        })
      }

      if (error.message.includes('payment')) {
        return res.status(400).json({
          error: 'Payment processing failed',
          details: 'Please check your payment method and try again',
        })
      }

      if (error.message.includes('401') || error.message.includes('403')) {
        return res.status(500).json({
          error: 'Authentication error',
          details: 'Server configuration issue',
        })
      }
    }

    res.status(500).json({
      error: 'Failed to process purchase',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)
