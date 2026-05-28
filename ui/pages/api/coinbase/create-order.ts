import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
} from '../../../lib/coinbase'
import { getCountryFromHeaders } from '../../../lib/geo'
import {
  validateCreateOrderInput,
  isRegionAllowed,
  resolvePartnerUserRef,
  buildCreateOrderRequestBody,
  extractOrderResult,
  applySandboxParam,
  type CreateOrderInput,
} from '../../../lib/coinbase/headlessOrder'

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const body: CreateOrderInput = req.body || {}
    const {
      partnerUserRef,
      paymentMethod = 'GUEST_CHECKOUT_APPLE_PAY',
    } = body

    const validation = validateCreateOrderInput(body)
    if (!validation.ok) {
      return res
        .status(validation.status)
        .json({ error: validation.error, ...(validation.code && { code: validation.code }) })
    }

    // In sandbox/mock mode prefix the partnerUserRef so Coinbase short-circuits
    // the payment without charging the card.
    const effectivePartnerUserRef = resolvePartnerUserRef(
      partnerUserRef as string,
      MOCK_ONRAMP
    )

    // Detect country for region restrictions (Headless = US only). Coinbase
    // determines the precise region itself from clientIp; we only gate here.
    const country = getCountryFromHeaders(req) || 'US'

    if (!isRegionAllowed(country)) {
      return res.status(400).json({
        error: 'Headless onramp is only available for US users',
        code: 'REGION_NOT_SUPPORTED',
      })
    }

    // Best-effort end-user IP for Coinbase's region determination.
    const forwardedFor = (req.headers['x-forwarded-for'] as string) || ''
    const clientIp =
      forwardedFor.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      undefined

    const credentials = validateCDPCredentials()

    const requestBody = buildCreateOrderRequestBody(body, {
      effectivePartnerUserRef,
      clientIp,
    })

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

    // Documented CDP v2 shape: { order: { orderId, ... }, paymentLink: { url } }
    let { paymentLinkUrl, orderId } = extractOrderResult(data)

    // Append sandbox query param for local/mock testing per docs
    if (paymentLinkUrl) {
      paymentLinkUrl = applySandboxParam(paymentLinkUrl, paymentMethod, MOCK_ONRAMP)
    }

    return res.status(200).json({
      paymentLinkUrl,
      orderId,
      raw: data,
    })
  } catch (error: any) {
    const errorResponse = handleAPIError(error, 'create onramp order')
    return res.status(errorResponse.status).json(errorResponse.body)
  }
}

export default withMiddleware(handler, authMiddleware)
