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
 * Builds the exact body sent to the CDP `/onramp/v2/orders` endpoint.
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
