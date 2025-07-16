import crypto from 'crypto'

if (!process.env.COINBASE_API_KEY || !process.env.COINBASE_API_SECRET) {
  throw new Error(
    'COINBASE_API_KEY and COINBASE_API_SECRET environment variables are required'
  )
}

// Coinbase API configuration
const COINBASE_API_BASE_URL = 'https://api.coinbase.com'
const COINBASE_ONRAMP_BASE_URL = 'https://api.commerce.coinbase.com'

// Types for Coinbase API responses
export interface CoinbaseQuoteRequest {
  app_id: string
  amount_fiat: string
  fiat_currency: string
  crypto_asset: string
  network: string
  destination_address: string
}

export interface CoinbaseQuoteResponse {
  quote_id: string
  total_amount: string
  crypto_amount: string
  fees: {
    coinbase_fee: string
    network_fee: string
  }
  expires_at: string
  exchange_rate: string
}

export interface CoinbasePurchaseRequest {
  app_id: string
  quote_id: string
  payment_method: 'stripe' | 'bank_transfer'
  payment_data: {
    stripe_payment_intent_id?: string
    bank_account_id?: string
  }
  destination_address: string
}

export interface CoinbasePurchaseResponse {
  purchase_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transaction_hash?: string
  estimated_delivery: string
  crypto_amount: string
  crypto_asset: string
  network: string
  tracking_url?: string
}

export interface CoinbaseExchangeRatesResponse {
  data: {
    currency: string
    rates: Record<string, string>
  }
}

/**
 * Create Coinbase API signature for authentication
 */
function createSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ''
): string {
  const message = timestamp + method.toUpperCase() + requestPath + body
  return crypto
    .createHmac('sha256', process.env.COINBASE_API_SECRET!)
    .update(message)
    .digest('hex')
}

/**
 * Make authenticated request to Coinbase API
 */
async function coinbaseRequest(
  method: string,
  path: string,
  body?: any,
  baseUrl: string = COINBASE_API_BASE_URL
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const bodyString = body ? JSON.stringify(body) : ''
  const signature = createSignature(timestamp, method, path, bodyString)

  const response = await fetch(`${baseUrl}${path}`, {
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

/**
 * Get current exchange rates from Coinbase
 */
export async function getExchangeRates(
  currency: string = 'USD'
): Promise<CoinbaseExchangeRatesResponse> {
  try {
    return await coinbaseRequest(
      'GET',
      `/v2/exchange-rates?currency=${currency}`
    )
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    throw new Error('Failed to fetch current exchange rates')
  }
}

/**
 * Get quote for crypto purchase
 */
export async function getCoinbaseQuote(
  request: CoinbaseQuoteRequest
): Promise<CoinbaseQuoteResponse> {
  try {
    // First get current exchange rates
    const rates = await getExchangeRates(request.fiat_currency)
    const cryptoRate = rates.data.rates[request.crypto_asset]

    if (!cryptoRate) {
      throw new Error(`Unsupported crypto asset: ${request.crypto_asset}`)
    }

    const fiatAmount = parseFloat(request.amount_fiat)
    if (isNaN(fiatAmount) || fiatAmount <= 0) {
      throw new Error('Invalid fiat amount')
    }

    // Calculate fees and amounts
    const coinbaseFeeRate = 0.015 // 1.5% fee
    const coinbaseFee = fiatAmount * coinbaseFeeRate

    // Network fees vary by asset
    const networkFees: Record<string, number> = {
      ETH: 15, // USD
      USDC: 5,
      BTC: 10,
    }
    const networkFee = networkFees[request.crypto_asset] || 5

    const totalAmount = fiatAmount + coinbaseFee + networkFee
    const cryptoPrice = 1 / parseFloat(cryptoRate)
    const cryptoAmount = (fiatAmount - networkFee) * cryptoPrice

    // Generate quote ID
    const quoteId = `quote_${Date.now()}_${crypto
      .randomBytes(8)
      .toString('hex')}`

    return {
      quote_id: quoteId,
      total_amount: totalAmount.toFixed(2),
      crypto_amount: cryptoAmount.toFixed(8),
      fees: {
        coinbase_fee: coinbaseFee.toFixed(2),
        network_fee: networkFee.toFixed(2),
      },
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      exchange_rate: cryptoRate,
    }
  } catch (error) {
    console.error('Error getting Coinbase quote:', error)
    throw error
  }
}

/**
 * Execute crypto purchase through Coinbase
 */
export async function executeCoinbasePurchase(
  request: CoinbasePurchaseRequest
): Promise<CoinbasePurchaseResponse> {
  try {
    // In a real implementation, this would call Coinbase's onramp API
    // For now, we'll simulate the response based on successful payment

    console.log('Executing Coinbase purchase:', {
      app_id: request.app_id,
      quote_id: request.quote_id,
      payment_method: request.payment_method,
      destination_address: request.destination_address,
    })

    // Simulate calling Coinbase Commerce API or Onramp API
    const purchaseId = `cb_purchase_${Date.now()}_${crypto
      .randomBytes(6)
      .toString('hex')}`

    // In production, you would make a real API call like:
    // const response = await coinbaseRequest('POST', '/onramp/v1/purchases', {
    //   quote_id: request.quote_id,
    //   payment_method: request.payment_method,
    //   payment_data: request.payment_data,
    //   destination_address: request.destination_address,
    // }, COINBASE_ONRAMP_BASE_URL)

    return {
      purchase_id: purchaseId,
      status: 'processing',
      estimated_delivery: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      crypto_amount: '0.045123', // This would come from the quote
      crypto_asset: 'ETH',
      network: 'ethereum',
      tracking_url: `https://commerce.coinbase.com/charges/${purchaseId}`,
    }
  } catch (error) {
    console.error('Error executing Coinbase purchase:', error)
    throw new Error('Failed to execute crypto purchase')
  }
}

/**
 * Get purchase status from Coinbase
 */
export async function getCoinbasePurchaseStatus(
  purchaseId: string
): Promise<CoinbasePurchaseResponse> {
  try {
    // In production, this would query the actual Coinbase API
    console.log('Getting purchase status for:', purchaseId)

    // Simulate API response
    return {
      purchase_id: purchaseId,
      status: 'completed',
      transaction_hash: `0x${crypto.randomBytes(32).toString('hex')}`,
      estimated_delivery: new Date().toISOString(),
      crypto_amount: '0.045123',
      crypto_asset: 'ETH',
      network: 'ethereum',
      tracking_url: `https://commerce.coinbase.com/charges/${purchaseId}`,
    }
  } catch (error) {
    console.error('Error getting purchase status:', error)
    throw new Error('Failed to get purchase status')
  }
}

/**
 * Verify Coinbase webhook signature
 */
export function verifyCoinbaseWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')

    return signature === computedSignature
  } catch (error) {
    console.error('Webhook verification error:', error)
    return false
  }
}

/**
 * Calculate fees for a crypto purchase
 */
export function calculateCoinbaseFees(
  fiatAmount: number,
  cryptoAsset: string
): { coinbase_fee: number; network_fee: number; total_fees: number } {
  const coinbaseFeeRate = 0.015 // 1.5%
  const coinbaseFee = fiatAmount * coinbaseFeeRate

  const networkFees: Record<string, number> = {
    ETH: 15,
    USDC: 5,
    BTC: 10,
  }
  const networkFee = networkFees[cryptoAsset] || 5
  const totalFees = coinbaseFee + networkFee

  return {
    coinbase_fee: Math.round(coinbaseFee * 100) / 100,
    network_fee: networkFee,
    total_fees: Math.round(totalFees * 100) / 100,
  }
}

/**
 * Validate Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate Bitcoin address (simplified)
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Basic validation - in production you'd want more comprehensive validation
  return (
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || // Legacy
    /^bc1[a-z0-9]{39,59}$/.test(address)
  ) // Bech32
}
