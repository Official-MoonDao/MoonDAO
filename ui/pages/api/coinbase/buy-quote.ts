import { randomBytes } from 'crypto'
import { SignJWT } from 'jose'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      paymentAmount,
      destinationAddress,
      purchaseNetwork = 'ethereum',
      paymentCurrency = 'USD',
      purchaseCurrency = 'ETH',
      country = 'US',
      subdivision = 'NY',
      paymentMethod = 'CARD',
    } = req.body

    if (!paymentAmount || !destinationAddress) {
      return res.status(400).json({
        error: 'Payment amount and destination address are required',
      })
    }

    const apiKeyName = process.env.CB_API_KEY
    const apiKeySecret = process.env.CB_API_SECRET

    if (!apiKeyName || !apiKeySecret) {
      return res.status(500).json({
        error: 'CDP API credentials not configured',
      })
    }

    // Create JWT for CDP API authentication
    const jwt = await generateCDPJWT(
      apiKeyName,
      apiKeySecret,
      'POST',
      '/onramp/v1/buy/quote'
    )

    // Prepare request body for buy quote
    const requestBody = {
      country,
      destinationAddress,
      paymentAmount: paymentAmount.toString(),
      paymentCurrency,
      paymentMethod,
      purchaseCurrency,
      purchaseNetwork,
      subdivision,
    }

    // Call CDP buy quote endpoint
    const response = await fetch(
      'https://api.developer.coinbase.com/onramp/v1/buy/quote',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'User-Agent': 'MoonDAO/1.0',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      return res.status(response.status).json({
        error: 'Failed to get buy quote',
        details: errorData,
        status: response.status,
      })
    }

    const data = await response.json()

    // Extract relevant quote information
    return res.status(200).json({
      quote: data,
      purchaseAmount: data.purchaseAmount,
      paymentTotal: data.paymentTotal,
      coinbaseFee: data.coinbaseFee,
      networkFee: data.networkFee,
      quoteId: data.quoteId,
    })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}

// Generate CDP JWT for API authentication
async function generateCDPJWT(
  apiKeyName: string,
  privateKeyBase64: string,
  method: string,
  path: string
): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const nonce = randomBytes(16).toString('hex')
    const uri = `${method} api.developer.coinbase.com${path}`

    const payload = {
      sub: apiKeyName,
      iss: 'cdp',
      nbf: now,
      exp: now + 120,
      uri: uri,
    }

    const header = {
      alg: 'EdDSA',
      kid: apiKeyName,
      nonce: nonce,
    }

    // Decode the 64-byte key from CDP
    const keyBuffer = Buffer.from(privateKeyBase64, 'base64')
    if (keyBuffer.length !== 64) {
      throw new Error(
        `Expected 64-byte Ed25519 key, got ${keyBuffer.length} bytes`
      )
    }

    const privateKeyBytes = keyBuffer.slice(0, 32)
    const publicKeyBytes = keyBuffer.slice(32, 64)

    const jwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      d: privateKeyBytes.toString('base64url'),
      x: publicKeyBytes.toString('base64url'),
      use: 'sig',
      alg: 'EdDSA',
    }

    const { importJWK } = await import('jose')
    const privateKey = await importJWK(jwk, 'EdDSA')

    const jwt = await new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(privateKey)

    return jwt
  } catch (error: any) {
    throw new Error(`CDP Ed25519 JWT generation failed: ${error.message}`)
  }
}
