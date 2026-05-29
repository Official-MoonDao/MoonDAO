import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
  CDP_HOST_V2,
} from '../../../lib/coinbase'
import { getCountryFromHeaders } from '../../../lib/geo'
import {
  validateCreateOrderInput,
  isRegionAllowed,
  resolvePartnerUserRef,
  buildCreateOrderRequestBody,
  extractOrderResult,
  applySandboxParam,
  sanitizeClientIp,
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

    // Detect country for region restrictions (Headless = US only). This is a
    // best-effort UX pre-filter: we only block on a POSITIVE non-US signal.
    // When the geo header is absent (no Vercel/Cloudflare edge header, some
    // proxies, local dev) we let the request through rather than blocking real
    // US users — Coinbase performs the authoritative region determination from
    // clientIp at order creation and rejects genuine non-US users there, so
    // allowing "unknown" through never lets an ineligible user complete a buy.
    const country = getCountryFromHeaders(req)

    if (country && !isRegionAllowed(country)) {
      return res.status(400).json({
        error: 'Headless onramp is only available for US users',
        code: 'REGION_NOT_SUPPORTED',
      })
    }

    // Best-effort end-user IP for Coinbase's region determination. Coinbase
    // rejects private/loopback IPs, so only forward a genuine public address.
    const forwardedFor = (req.headers['x-forwarded-for'] as string) || ''
    const clientIp =
      sanitizeClientIp(forwardedFor) ||
      sanitizeClientIp(req.headers['x-real-ip'] as string) ||
      sanitizeClientIp(req.socket?.remoteAddress) ||
      undefined

    const credentials = validateCDPCredentials()

    const requestBody = buildCreateOrderRequestBody(body, {
      effectivePartnerUserRef,
      clientIp,
    })

    const response = await makeCDPRequest(
      '/platform/v2/onramp/orders',
      'POST',
      requestBody,
      credentials,
      CDP_HOST_V2
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
