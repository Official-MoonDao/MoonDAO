import { Redis } from '@upstash/redis'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
} from '../../../lib/coinbase'
import {
  detectUserState,
  isValidUSState,
  getCountryFromHeaders,
} from '../../../lib/geo'

// Initialize Redis client for geolocation caching (matches buy-quote.ts)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

interface CreateOrderRequest {
  // Required
  paymentAmount: number // USD amount (string in API, we convert)
  destinationAddress: string
  email: string
  phoneNumber: string // E.164 format, e.g. +12345678901
  partnerUserRef: string // unique per-user identifier
  // Optional / overrides
  purchaseCurrency?: string // default ETH
  purchaseNetwork?: string // default ethereum
  paymentCurrency?: string // default USD
  paymentMethod?: 'APPLE_PAY' | 'GOOGLE_PAY'
  domain?: string // required for web iframe in prod (must be in CDP allow list)
  country?: string
  subdivision?: string
  agreementAcceptedAt?: string // ISO timestamp
  quoteId?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const {
      paymentAmount,
      destinationAddress,
      email,
      phoneNumber,
      partnerUserRef,
      purchaseCurrency = 'ETH',
      purchaseNetwork = 'ethereum',
      paymentCurrency = 'USD',
      paymentMethod = 'APPLE_PAY',
      domain,
      country: providedCountry,
      subdivision,
      agreementAcceptedAt,
      quoteId,
    }: CreateOrderRequest = req.body

    if (!paymentAmount || !destinationAddress) {
      return res
        .status(400)
        .json({ error: 'paymentAmount and destinationAddress are required' })
    }
    if (!email || !phoneNumber) {
      return res
        .status(400)
        .json({ error: 'email and phoneNumber are required for headless onramp' })
    }
    if (!partnerUserRef) {
      return res.status(400).json({ error: 'partnerUserRef is required' })
    }
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ error: 'phoneNumber must be in E.164 format (e.g. +12345678901)' })
    }

    // In sandbox/mock mode prefix the partnerUserRef so Coinbase short-circuits
    // the payment without charging the card.
    const effectivePartnerUserRef =
      MOCK_ONRAMP && !partnerUserRef.startsWith('sandbox-')
        ? `sandbox-${partnerUserRef}`
        : partnerUserRef

    // Detect country / state for region restrictions (Headless = US only)
    const headerCountry = getCountryFromHeaders(req)
    const country = providedCountry || headerCountry || 'US'

    let detectedSubdivision = subdivision
    if (!detectedSubdivision && country === 'US') {
      try {
        const stateCode = await detectUserState(req, redis)
        if (stateCode && isValidUSState(stateCode)) {
          detectedSubdivision = stateCode
        }
      } catch (error) {
        console.error('Error detecting state for create-order:', error)
      }
    }

    if (country !== 'US') {
      return res.status(400).json({
        error: 'Headless onramp is only available for US users',
        code: 'REGION_NOT_SUPPORTED',
      })
    }

    const credentials = validateCDPCredentials()

    const requestBody: Record<string, unknown> = {
      paymentAmount: paymentAmount.toFixed(2),
      paymentCurrency,
      purchaseCurrency,
      purchaseNetwork,
      destinationAddress,
      paymentMethod,
      email,
      phoneNumber,
      partnerUserRef: effectivePartnerUserRef,
      country,
      ...(detectedSubdivision && { subdivision: detectedSubdivision }),
      ...(domain && { domain }),
      ...(agreementAcceptedAt && { agreementAcceptedAt }),
      ...(quoteId && { quoteId }),
    }

    const response = await makeCDPRequest(
      '/onramp/v2/orders',
      'POST',
      requestBody,
      credentials
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let errorJson: any = {}
      try {
        errorJson = JSON.parse(errorText)
      } catch {
        /* ignore */
      }
      console.error('CDP create-order error:', {
        status: response.status,
        body: errorJson || errorText,
      })
      return res.status(response.status).json({
        error: errorJson?.error_message || errorJson?.error || 'Failed to create onramp order',
        code: errorJson?.error_type || errorJson?.code,
        details: errorJson || errorText,
      })
    }

    const data = await response.json()

    // Coinbase v2 response shape: { order_id, payment_link_url, ... }
    let paymentLinkUrl: string | undefined =
      data?.payment_link_url || data?.paymentLinkUrl

    // Append sandbox query param for local/mock testing per docs
    if (MOCK_ONRAMP && paymentLinkUrl) {
      const separator = paymentLinkUrl.includes('?') ? '&' : '?'
      const sandboxParam =
        paymentMethod === 'GOOGLE_PAY'
          ? 'useGooglePaySandbox=true'
          : 'useApplePaySandbox=true'
      paymentLinkUrl = `${paymentLinkUrl}${separator}${sandboxParam}`
    }

    return res.status(200).json({
      paymentLinkUrl,
      orderId: data?.order_id || data?.orderId,
      raw: data,
    })
  } catch (error: any) {
    const errorResponse = handleAPIError(error, 'create onramp order')
    return res.status(errorResponse.status).json(errorResponse.body)
  }
}

export default withMiddleware(handler, authMiddleware)
