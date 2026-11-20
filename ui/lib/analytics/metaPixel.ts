/**
 * Meta Pixel, limited to the membership funnel and gated on consent.
 *
 * The pixel only loads when all of these hold:
 *  - NEXT_PUBLIC_META_PIXEL_ID is set (unset means the whole module is a no-op),
 *  - the page is one of PIXEL_PATHS (the paid landing page, /join, /citizen),
 *  - the visitor has granted analytics consent (`cookie_consent` is true),
 *  - the browser does not send Global Privacy Control, and
 *  - the visitor has not opted out on /privacy-choices.
 *
 * Events carry no wallet address, name, email, or other identifier. Automatic
 * event collection (button text, form fields) is turned off. Purchase uses the
 * transaction hash as its event ID so a later server-side event can be
 * de-duplicated against it.
 */
import { CONSENT_STORAGE_KEY } from './attribution'

export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '').trim()

export const AD_OPT_OUT_STORAGE_KEY = 'md_ad_opt_out'
export const CONSENT_CHANGE_EVENT = 'md:consent-change'

export const PIXEL_PATHS = new Set(['/citizenship', '/join', '/citizen'])

const PIXEL_ID_PATTERN = /^\d{6,20}$/
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[]
  loaded?: boolean
  version?: string
  push?: unknown
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

let loaded = false

export function isValidPixelId(id: string | undefined | null): boolean {
  return !!id && PIXEL_ID_PATTERN.test(id)
}

export function isPixelPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return PIXEL_PATHS.has(clean)
}

export type PixelConsentInput = {
  pixelId: string | undefined | null
  analyticsConsent: boolean | null
  globalPrivacyControl: boolean
  optedOut: boolean
}

/** Pure decision, so it can be tested without a browser. */
export function pixelAllowed(input: PixelConsentInput): boolean {
  if (!isValidPixelId(input.pixelId)) return false
  if (input.globalPrivacyControl) return false
  if (input.optedOut) return false
  return input.analyticsConsent === true
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readConsent(): boolean | null {
  const raw = readStorage(CONSENT_STORAGE_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed === true ? true : parsed === false ? false : null
  } catch {
    return null
  }
}

export function readAdOptOut(): boolean {
  return readStorage(AD_OPT_OUT_STORAGE_KEY) === 'true'
}

export function readGlobalPrivacyControl(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true
  } catch {
    return false
  }
}

export function setAdOptOut(optOut: boolean): void {
  try {
    if (optOut) window.localStorage.setItem(AD_OPT_OUT_STORAGE_KEY, 'true')
    else window.localStorage.removeItem(AD_OPT_OUT_STORAGE_KEY)
  } catch {
    // Storage blocked: the choice cannot persist, but this page load honors it.
  }
  if (optOut) revokePixel()
  notifyConsentChange()
}

export function notifyConsentChange(): void {
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
  } catch {
    // Old browsers without the Event constructor: the next page load re-reads.
  }
}

function currentlyAllowed(): boolean {
  if (typeof window === 'undefined') return false
  return pixelAllowed({
    pixelId: META_PIXEL_ID,
    analyticsConsent: readConsent(),
    globalPrivacyControl: readGlobalPrivacyControl(),
    optedOut: readAdOptOut(),
  })
}

/** Meta's base snippet, without the automatic PageView. */
function installBaseCode(pixelId: string): void {
  if (window.fbq) return
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue!.push(args)
  }
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  // Do not auto-fire PageView on client-side navigation: off-funnel pages
  // must not report. PageView is sent explicitly on funnel paths only.
  ;(fbq as Fbq & { disablePushState?: boolean }).disablePushState = true
  window.fbq = fbq
  window._fbq = fbq
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('set', 'autoConfig', false, pixelId)
  fbq('init', pixelId)
}

/** Loads the pixel if this page and this visitor allow it. Returns whether it is active. */
export function ensurePixel(pathname: string): boolean {
  if (!isPixelPath(pathname) || !currentlyAllowed()) return false
  if (!loaded) {
    installBaseCode(META_PIXEL_ID)
    loaded = true
  }
  return true
}

/** Stops further events for this page load after an opt-out. */
export function revokePixel(): void {
  if (!loaded || typeof window === 'undefined' || !window.fbq) return
  try {
    window.fbq('consent', 'revoke')
  } catch {
    // Nothing else to do: no further events are sent from this module.
  }
  loaded = false
}

function send(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (!ensurePixel(window.location?.pathname || '')) return
    if (eventId) window.fbq!('track', event, params || {}, { eventID: eventId })
    else if (params) window.fbq!('track', event, params)
    else window.fbq!('track', event)
  } catch {
    // Analytics must never break checkout.
  }
}

export function pixelPageView(): void {
  send('PageView')
}

export function pixelViewContent(contentName: string): void {
  send('ViewContent', { content_name: contentName, content_category: 'membership' })
}

export function pixelInitiateCheckout(valueUsd: number): void {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) return
  send('InitiateCheckout', {
    content_name: 'Citizenship',
    currency: 'USD',
    value: Math.round(valueUsd * 100) / 100,
  })
}

export function pixelPurchase(valueUsd: number, transactionId?: string): void {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) return
  const eventId = transactionId && TX_HASH.test(transactionId) ? transactionId : undefined
  send(
    'Purchase',
    { content_name: 'Citizenship', currency: 'USD', value: Math.round(valueUsd * 100) / 100 },
    eventId
  )
}

/** Test hook. */
export function resetMetaPixelState(): void {
  loaded = false
}
