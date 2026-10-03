/**
 * Marketplace purchase receipts (buyer, vendor, and info@moondao.com).
 *
 * Two production failures dropped every copy of the receipt:
 *
 * 1. The route is behind authMiddleware, which returns 401 unless the request
 *    has an Authorization Bearer token or a NextAuth session cookie. The buy
 *    modal stopped sending the Bearer header when iron-session was removed, so
 *    a Privy-only session (expired NextAuth cookie, sign-in race, blocked
 *    cookie) paid on-chain and then never reached sendMail.
 *
 * 2. Vendor email lookup (Tableland, Typeform with no timeout, Safe owners,
 *    citizen forms) ran before any send. This route had no maxDuration, so the
 *    ~10s platform limit killed the function during lookup and nobody was
 *    mailed. Buyer mail is sent first; the lookup is capped.
 */

export const BUYER_RECEIPT_SUBJECT = 'MoonDAO | Marketplace Purchase'
export const VENDOR_RECEIPT_SUBJECT = 'MoonDAO | Marketplace Purchase'
export const VENDOR_MISSING_SUBJECT =
  'MoonDAO | Marketplace Purchase (vendor email not found, please forward)'
export const OPS_FALLBACK_SUBJECT =
  'MoonDAO | Marketplace Purchase (buyer receipt failed, please follow up)'

export const PURCHASE_NOTIFICATION_PATH = '/api/marketplace/marketplace-purchase'

export type PurchaseMailContent = {
  text: string
  html: string
}

export type PurchaseMail = PurchaseMailContent & {
  to: string
  bcc?: string[]
  subject: string
}

export type PurchaseNotificationResponse = {
  success: boolean
  status: number
  message: string
  giftLink?: string
}

export function parsePurchaseBody(body: unknown): Record<string, unknown> | null {
  let value = body
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return null
    try {
      value = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Resolve `promise`, or null when it rejects or exceeds `ms`. A hung Typeform
 * or Tableland call must not keep the receipt from being sent.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      }
    )
  })
}

export async function deliverMarketplaceReceipts(params: {
  buyerEmail: string
  opsEmail: string
  buyerContent: PurchaseMailContent
  vendorContent: PurchaseMailContent
  lookupVendorEmail: () => Promise<string | null>
  sendMail: (mail: PurchaseMail) => Promise<void>
  vendorLookupTimeoutMs?: number
}): Promise<{
  buyerSent: boolean
  vendorSent: boolean
  opsNotified: boolean
  vendorEmail: string | null
}> {
  const timeoutMs = params.vendorLookupTimeoutMs ?? 10_000
  let buyerSent = false
  let vendorSent = false
  let opsNotified = false

  // Buyer + MoonDAO copy first. BCC is part of this message, so a rejected
  // buyer address fails the whole send — ops is notified separately below.
  if (params.buyerEmail.trim()) {
    try {
      await params.sendMail({
        to: params.buyerEmail.trim(),
        bcc: [params.opsEmail],
        subject: BUYER_RECEIPT_SUBJECT,
        ...params.buyerContent,
      })
      buyerSent = true
      opsNotified = true
    } catch {
      buyerSent = false
    }
  }

  const vendorEmail = await withTimeout(params.lookupVendorEmail(), timeoutMs)
  const vendorTo = vendorEmail || params.opsEmail
  try {
    await params.sendMail({
      to: vendorTo,
      subject: vendorEmail ? VENDOR_RECEIPT_SUBJECT : VENDOR_MISSING_SUBJECT,
      ...params.vendorContent,
    })
    vendorSent = true
    if (vendorTo === params.opsEmail) opsNotified = true
  } catch {
    vendorSent = false
  }

  if (!opsNotified) {
    try {
      await params.sendMail({
        to: params.opsEmail,
        subject: OPS_FALLBACK_SUBJECT,
        ...params.vendorContent,
      })
      opsNotified = true
    } catch {
      opsNotified = false
    }
  }

  return { buyerSent, vendorSent, opsNotified, vendorEmail }
}

export function purchaseAlreadyRecorded(status: number, message: string): boolean {
  return status === 400 && message.includes('already been processed')
}

export function isRetryablePurchaseStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

type PurchaseFetch = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    keepalive?: boolean
  }
) => Promise<{
  ok: boolean
  status: number
  text: () => Promise<string>
}>

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function messageFromBody(parsed: unknown, raw: string): string {
  if (typeof parsed === 'string') return parsed
  if (parsed && typeof parsed === 'object' && 'message' in parsed) {
    const message = (parsed as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return raw
}

/**
 * POST the purchase receipt. Always sends the Privy access token as a Bearer
 * header so authMiddleware lets the request through when the NextAuth cookie
 * is absent. Retries platform and mailer failures; a replay of a tx the server
 * already accepted counts as success so a dropped response doesn't look like
 * a failed purchase.
 */
export async function postMarketplacePurchase(options: {
  payload: Record<string, unknown>
  accessToken: string | null
  fetchImpl?: PurchaseFetch
  maxAttempts?: number
  backoffMs?: number
}): Promise<PurchaseNotificationResponse> {
  const fetchImpl = (options.fetchImpl || fetch) as PurchaseFetch
  const maxAttempts = options.maxAttempts ?? 3
  const backoffMs = options.backoffMs ?? 600
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  let lastStatus = 0
  let lastMessage = ''

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchImpl(PURCHASE_NOTIFICATION_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...options.payload,
          accessToken: options.accessToken,
        }),
        keepalive: true,
      })
      lastStatus = response.status
      const raw = await response.text().catch(() => '')
      let parsed: unknown = raw
      if (raw) {
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = { message: raw }
        }
      } else {
        parsed = {}
      }
      lastMessage = messageFromBody(parsed, raw)

      if (purchaseAlreadyRecorded(response.status, lastMessage)) {
        return { success: true, status: response.status, message: lastMessage }
      }

      const parsedGift =
        parsed && typeof parsed === 'object'
          ? (parsed as { giftLink?: unknown }).giftLink
          : undefined
      const giftLink = typeof parsedGift === 'string' ? parsedGift : undefined

      if (response.ok) {
        const success =
          !!parsed &&
          typeof parsed === 'object' &&
          (parsed as { success?: unknown }).success === true
        return { success, status: response.status, message: lastMessage, giftLink }
      }

      if (!isRetryablePurchaseStatus(response.status) || attempt === maxAttempts - 1) {
        return { success: false, status: response.status, message: lastMessage, giftLink }
      }
    } catch (err: any) {
      lastStatus = 0
      lastMessage = err?.message || 'Network error'
      if (attempt === maxAttempts - 1) {
        return { success: false, status: 0, message: lastMessage }
      }
    }
    await sleep(backoffMs * (attempt + 1))
  }

  return { success: false, status: lastStatus, message: lastMessage }
}
