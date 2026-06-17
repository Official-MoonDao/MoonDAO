import { randomBytes } from 'crypto'
import { SignJWT } from 'jose'

// Types
export interface CDPCredentials {
  apiKeyName: string
  apiKeySecret: string
}

export interface CDPJWTOptions {
  method: string
  path: string
  apiKeyName: string
  privateKeyBase64: string
  /** API host used in the JWT `uri` claim. Defaults to the v1 host. */
  host?: string
}

export interface SessionTokenRequest {
  address: string
  blockchains?: string[]
  assets?: string[]
}

export interface BuyQuoteRequest {
  paymentAmount: number // USD amount
  destinationAddress: string
  purchaseNetwork?: string
  paymentCurrency?: string
  purchaseCurrency?: string
  country?: string
  subdivision?: string
  paymentMethod?: string
  channelId?: string
}

// v2 Headless (Apple Pay / Google Pay) onramp order
export type OnrampOrderPaymentMethod =
  | 'GUEST_CHECKOUT_APPLE_PAY'
  | 'GUEST_CHECKOUT_GOOGLE_PAY'

export interface CreateOnrampOrderRequest {
  destinationAddress: string
  destinationNetwork: string
  /** Crypto amount to receive (exclusive of fees). Either this or paymentAmount. */
  purchaseAmount?: string
  /** Fiat amount to pay (inclusive of fees). Either this or purchaseAmount. */
  paymentAmount?: string
  purchaseCurrency?: string
  paymentCurrency?: string
  paymentMethod: OnrampOrderPaymentMethod
  /** Verified user email (verified by the app via Privy/OTP). */
  email: string
  /** Verified user phone in E.164 format. */
  phoneNumber: string
  /** ISO timestamp the phone number was verified (must be < 60 days old). */
  phoneNumberVerifiedAt: string
  /** ISO timestamp the user accepted Coinbase's guest checkout terms. */
  agreementAcceptedAt: string
  /** Stable reference for the user. Prefix with `sandbox-` for sandbox orders. */
  partnerUserRef: string
  /** Domain the Apple Pay button renders on (required for iframe embedding). */
  domain?: string
}

// Environment validation
export function validateCDPCredentials(): CDPCredentials {
  const apiKeyName = process.env.CB_API_KEY
  const apiKeySecret = process.env.CB_API_SECRET

  if (!apiKeyName || !apiKeySecret) {
    throw new Error(
      'CDP API credentials not configured: Missing CB_API_KEY or CB_API_SECRET environment variables'
    )
  }

  return { apiKeyName, apiKeySecret }
}

// JWT generation for CDP API
export async function generateCDPJWT({
  method,
  path,
  apiKeyName,
  privateKeyBase64,
  host = 'api.developer.coinbase.com',
}: CDPJWTOptions): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const nonce = randomBytes(16).toString('hex')
    const uri = `${method} ${host}${path}`

    const payload = {
      sub: apiKeyName,
      iss: 'cdp',
      nbf: now,
      exp: now + 120, // 2 minutes max as per CDP requirements
      uri: uri,
    }

    const header = {
      alg: 'EdDSA',
      kid: apiKeyName,
      nonce: nonce,
    }

    // Decode the 64-byte Ed25519 key from CDP
    const keyBuffer = Buffer.from(privateKeyBase64, 'base64')
    if (keyBuffer.length !== 64) {
      throw new Error(
        `Expected 64-byte Ed25519 key, got ${keyBuffer.length} bytes`
      )
    }

    // Ed25519 64-byte format: private_key (32 bytes) + public_key (32 bytes)
    const privateKeyBytes = keyBuffer.slice(0, 32)
    const publicKeyBytes = keyBuffer.slice(32, 64)

    // Create JWK for Ed25519
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

// Common CDP API request wrapper
export async function makeCDPRequest(
  endpoint: string,
  method: string,
  body: any,
  credentials: CDPCredentials
): Promise<Response> {
  const jwt = await generateCDPJWT({
    method,
    path: endpoint,
    apiKeyName: credentials.apiKeyName,
    privateKeyBase64: credentials.apiKeySecret,
  })

  return fetch(`https://api.developer.coinbase.com${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'User-Agent': 'MoonDAO/1.0',
    },
    body: JSON.stringify(body),
  })
}

// v2 CDP API request wrapper (host: api.cdp.coinbase.com).
// The v2 Onramp Order API lives on a different host than the v1 onramp APIs,
// so the JWT `uri` claim host must match.
const CDP_V2_HOST = 'api.cdp.coinbase.com'

export async function makeCDPV2Request(
  endpoint: string,
  method: string,
  body: any,
  credentials: CDPCredentials
): Promise<Response> {
  const jwt = await generateCDPJWT({
    method,
    path: endpoint,
    apiKeyName: credentials.apiKeyName,
    privateKeyBase64: credentials.apiKeySecret,
    host: CDP_V2_HOST,
  })

  return fetch(`https://${CDP_V2_HOST}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'User-Agent': 'MoonDAO/1.0',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

// Error response helpers
export function createErrorResponse(
  status: number,
  error: string,
  details?: any
) {
  return {
    status,
    body: {
      error,
      ...(details && { details }),
    },
  }
}

export function handleAPIError(error: any, operation: string) {
  return createErrorResponse(500, 'Internal server error', {
    operation,
    message: error.message,
  })
}
