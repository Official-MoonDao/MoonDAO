/**
 * Pure, framework-free helpers for the Coinbase Headless Onramp `create-order`
 * endpoint. Extracted from `pages/api/coinbase/create-order.ts` so the
 * validation / request-building / region logic can be unit tested without
 * spinning up Next.js or hitting Coinbase.
 *
 * Field names + enums verified against the official API reference:
 * https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order
 */

export const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/

// Coinbase only supports the GUEST_CHECKOUT_* payment methods for this API.
export type OnrampPaymentMethod =
  | 'GUEST_CHECKOUT_APPLE_PAY'
  | 'GUEST_CHECKOUT_GOOGLE_PAY'

export interface CreateOrderInput {
  paymentAmount?: number
  destinationAddress?: string
  email?: string
  phoneNumber?: string
  /** ISO-8601 timestamp of the most recent OTP verification (required, <60d). */
  phoneNumberVerifiedAt?: string
  partnerUserRef?: string
  purchaseCurrency?: string
  /** Crypto network the purchased asset is delivered on (CDP: destinationNetwork). */
  destinationNetwork?: string
  paymentCurrency?: string
  paymentMethod?: OnrampPaymentMethod
  domain?: string
  agreementAcceptedAt?: string
  /** End-user IP, used by Coinbase for region determination. */
  clientIp?: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string }

/**
 * Validates the inbound request body. Returns the first failing rule so the
 * handler can mirror the original sequential checks exactly.
 */
export function validateCreateOrderInput(body: CreateOrderInput): ValidationResult {
  const {
    paymentAmount,
    destinationAddress,
    email,
    phoneNumber,
    phoneNumberVerifiedAt,
    partnerUserRef,
    agreementAcceptedAt,
  } = body

  if (!paymentAmount || !destinationAddress) {
    return {
      ok: false,
      status: 400,
      error: 'paymentAmount and destinationAddress are required',
    }
  }
  if (!email || !phoneNumber) {
    return {
      ok: false,
      status: 400,
      error: 'email and phoneNumber are required for headless onramp',
    }
  }
  if (!partnerUserRef) {
    return { ok: false, status: 400, error: 'partnerUserRef is required' }
  }
  if (!PHONE_E164_REGEX.test(phoneNumber)) {
    return {
      ok: false,
      status: 400,
      error: 'phoneNumber must be in E.164 format (e.g. +12345678901)',
    }
  }
  if (!phoneNumberVerifiedAt) {
    return {
      ok: false,
      status: 400,
      error:
        'phoneNumberVerifiedAt is required (phone must be verified within 60 days)',
    }
  }
  if (!agreementAcceptedAt) {
    return { ok: false, status: 400, error: 'agreementAcceptedAt is required' }
  }
  return { ok: true }
}

/**
 * Headless Onramp is US-only. Returns true when the order is allowed to proceed.
 */
export function isRegionAllowed(country: string | null | undefined): boolean {
  return country === 'US'
}

/**
 * Coinbase rejects private / loopback / link-local IPs ("private IP addresses
 * are not allowed"). `clientIp` is optional, so we only forward a genuine
 * public address. Returns the trimmed IP when it's public, otherwise undefined.
 *
 * Verified against the live API: sending 127.0.0.1 returns HTTP 400.
 */
export function sanitizeClientIp(
  raw: string | null | undefined
): string | undefined {
  if (!raw) return undefined
  // Take the first hop if a comma-separated x-forwarded-for slipped through,
  // and strip an optional IPv6 zone id and surrounding brackets/whitespace.
  let ip = raw.split(',')[0]?.trim() || ''
  ip = ip.replace(/^\[|\]$/g, '').split('%')[0]
  // Strip a trailing :port for IPv4 (but not for bare IPv6).
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0]
  if (!ip) return undefined

  const lower = ip.toLowerCase()

  // IPv6 loopback / unspecified / unique-local (fc00::/7) / link-local (fe80::/10).
  if (lower === '::1' || lower === '::') return undefined
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return undefined
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return undefined
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) — fall through to IPv4 checks below.
  const mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) ip = mapped[1]

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10) return undefined // 10.0.0.0/8
    if (a === 127) return undefined // loopback
    if (a === 0) return undefined // 0.0.0.0/8
    if (a === 169 && b === 254) return undefined // link-local
    if (a === 172 && b >= 16 && b <= 31) return undefined // 172.16.0.0/12
    if (a === 192 && b === 168) return undefined // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return undefined // CGNAT 100.64.0.0/10
    return ip
  }

  // Non-IPv4 that survived the private/loopback IPv6 checks above: treat as a
  // public IPv6 address.
  return ip
}

/**
 * In sandbox/mock mode, Coinbase short-circuits the charge when the
 * partnerUserRef is prefixed with `sandbox-`. Idempotent — never double-prefixes.
 */
export function resolvePartnerUserRef(
  partnerUserRef: string,
  mock: boolean
): string {
  if (mock && !partnerUserRef.startsWith('sandbox-')) {
    return `sandbox-${partnerUserRef}`
  }
  return partnerUserRef
}

/**
 * Builds the exact body sent to the CDP `/platform/v2/onramp/orders` endpoint.
 * Optional fields are only included when present.
 */
export function buildCreateOrderRequestBody(
  input: CreateOrderInput,
  opts: {
    effectivePartnerUserRef: string
    clientIp?: string
  }
): Record<string, unknown> {
  const {
    paymentAmount,
    purchaseCurrency = 'ETH',
    destinationNetwork = 'base',
    paymentCurrency = 'USD',
    paymentMethod = 'GUEST_CHECKOUT_APPLE_PAY',
    destinationAddress,
    email,
    phoneNumber,
    phoneNumberVerifiedAt,
    domain,
    agreementAcceptedAt,
  } = input

  return {
    paymentAmount: Number(paymentAmount).toFixed(2),
    paymentCurrency,
    purchaseCurrency,
    destinationNetwork,
    destinationAddress,
    paymentMethod,
    email,
    phoneNumber,
    phoneNumberVerifiedAt,
    partnerUserRef: opts.effectivePartnerUserRef,
    agreementAcceptedAt,
    ...(domain && { domain }),
    ...(opts.clientIp && { clientIp: opts.clientIp }),
  }
}

/**
 * Extracts the payment link URL + order id from the (nested) CDP response,
 * tolerating both the documented `{ order, paymentLink }` shape and a couple of
 * legacy/flat fallbacks.
 */
export function extractOrderResult(data: any): {
  paymentLinkUrl: string | undefined
  orderId: string | undefined
} {
  const paymentLinkUrl =
    data?.paymentLink?.url ??
    data?.payment_link?.url ??
    data?.payment_link_url ??
    data?.paymentLinkUrl
  const orderId =
    data?.order?.orderId ??
    data?.order?.order_id ??
    data?.order_id ??
    data?.orderId
  return { paymentLinkUrl, orderId }
}

/**
 * Appends the correct sandbox query param to the returned payment link when in
 * mock mode. Picks the right param based on the payment method and preserves an
 * existing query string.
 */
export function applySandboxParam(
  paymentLinkUrl: string,
  paymentMethod: OnrampPaymentMethod | undefined,
  mock: boolean
): string {
  if (!mock || !paymentLinkUrl) return paymentLinkUrl
  const separator = paymentLinkUrl.includes('?') ? '&' : '?'
  const sandboxParam =
    paymentMethod === 'GUEST_CHECKOUT_GOOGLE_PAY'
      ? 'useGooglePaySandbox=true'
      : 'useApplePaySandbox=true'
  return `${paymentLinkUrl}${separator}${sandboxParam}`
}
