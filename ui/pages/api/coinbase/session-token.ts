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
      address,
      blockchains = ['ethereum', 'base'],
      assets = ['ETH', 'USDC'],
    } = req.body

    if (!address) {
      return res.status(400).json({ error: 'Address is required' })
    }

    const apiKeyName = process.env.CB_API_KEY
    const apiKeySecret = process.env.CB_API_SECRET

    if (!apiKeyName || !apiKeySecret) {
      return res.status(500).json({
        error: 'CDP API credentials not configured',
        details:
          'Missing COINBASE_API_KEY or COINBASE_API_SECRET environment variables',
      })
    }

    // For CDP API authentication, we need to create a JWT with specific claims
    const now = Math.floor(Date.now() / 1000)

    // Define the endpoint being accessed for the URI claim
    const requestMethod = 'POST'
    const requestHost = 'api.developer.coinbase.com'
    const requestPath = '/onramp/v1/token'
    const uri = `${requestMethod} ${requestHost}${requestPath}`

    // Create JWT payload for CDP - all required claims per documentation
    const payload = {
      sub: apiKeyName, // API key name
      iss: 'cdp', // Required issuer for CDP
      nbf: now, // Not before (current time)
      exp: now + 120, // Expires in 2 minutes (max allowed)
      uri: uri, // The endpoint being accessed
    }

    // Generate a random nonce as required by CDP
    const nonce = randomBytes(16).toString('hex')

    // Create JWT header with required fields
    const header = {
      alg: 'EdDSA',
      kid: apiKeyName, // Key ID as required
      nonce: nonce, // Random nonce as required
    }

    // Generate JWT with proper CDP format
    const jwt = await generateCDPJWT(header, payload, apiKeySecret, apiKeyName)

    // Prepare request body for CDP session token API - match documentation format
    const requestBody = {
      addresses: [
        {
          address: address,
          blockchains: blockchains,
        },
      ],
      assets: assets,
    }

    // Call CDP session token endpoint
    const response = await fetch(
      'https://api.developer.coinbase.com/onramp/v1/token',
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
        error: 'Failed to generate session token',
        details: errorData,
        status: response.status,
      })
    }

    const data = await response.json()

    return res.status(200).json({
      sessionToken: data?.token,
      channelId: data?.channel_id,
    })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}

// CDP JWT generation - handle Ed25519 key format from CDP per official documentation
async function generateCDPJWT(
  header: any,
  payload: any,
  privateKeyBase64: string,
  apiKeyName: string
): Promise<string> {
  try {
    // Decode the 64-byte key from CDP
    const keyBuffer = Buffer.from(privateKeyBase64, 'base64')

    if (keyBuffer.length !== 64) {
      throw new Error(
        `Expected 64-byte Ed25519 key, got ${keyBuffer.length} bytes`
      )
    }

    // For Ed25519, the 64-byte format is typically: private_key (32 bytes) + public_key (32 bytes)
    const privateKeyBytes = keyBuffer.slice(0, 32)
    const publicKeyBytes = keyBuffer.slice(32, 64)

    // Convert to base64url for JWK format
    const privateKeyBase64Url = privateKeyBytes.toString('base64url')
    const publicKeyBase64Url = publicKeyBytes.toString('base64url')

    // Create JWK for Ed25519
    const jwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      d: privateKeyBase64Url,
      x: publicKeyBase64Url,
      use: 'sig',
      alg: 'EdDSA',
    }

    const { importJWK } = await import('jose')
    const privateKey = await importJWK(jwk, 'EdDSA')

    const jwt = await new SignJWT(payload)
      .setProtectedHeader(header) // Use the full header with kid and nonce
      .sign(privateKey)

    return jwt
  } catch (error: any) {
    throw new Error(`CDP Ed25519 JWT generation failed: ${error.message}`)
  }
}
