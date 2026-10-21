import { COOKIE_CONSENT_EXEMPT_REGIONS } from '../geo/countryCode'

/**
 * GA4 helpers for moondao.com (stream G-QPFCD9VH46).
 *
 * Page views are left to the gtag config hit plus Enhanced Measurement history
 * events. This module does not send a second page_view on route change.
 * `buildPagePath` is the correct pathname + search join (search keeps "?").
 *
 * Every call no-ops when `window` is missing (SSR). If `gtag` is not defined
 * yet, events are queued and sent by `flushPendingGa4` once the snippet loads.
 *
 * Ticket D (UTM and click ids) plugs in through `setAttributionGetter`.
 * `getAttribution()` is merged into mint success, purchase, and mint_error.
 */

export const GA_MEASUREMENT_ID = 'G-QPFCD9VH46'

export const INTERNAL_QUERY_PARAM = 'internal'
export const INTERNAL_COOKIE_NAME = 'internal'

const BLOCKED_KEYS = new Set([
  'address',
  'email',
  'name',
  'wallet',
  'wallet_address',
  'user_address',
  'user_email',
  'full_name',
  'first_name',
  'last_name',
  'username',
])

const WALLET_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

export type AnalyticsPlan = 'citizen' | 'team'
export type PaymentMethod = 'crypto' | 'card'
export type AttributionParams = Record<string, string | number>

type GtagFn = (...args: any[]) => void

declare global {
  interface Window {
    gtag?: GtagFn
    dataLayer?: any[]
  }
}

const pending: unknown[][] = []
const MAX_PENDING = 30

let attributionGetter: () => AttributionParams | null | undefined = () => ({})

export function resetAnalyticsState() {
  pending.length = 0
  attributionGetter = () => ({})
}

/** Other branches register UTM / click-id params here. Must not throw into callers. */
export function setAttributionGetter(getter: () => AttributionParams | null | undefined) {
  attributionGetter = getter
}

export function getAttribution(): AttributionParams {
  try {
    return cleanAttribution(attributionGetter())
  } catch {
    return {}
  }
}

export function safeMeasurementId(id: string | undefined | null): string {
  if (id && /^G-[A-Z0-9]+$/.test(id)) return id
  return GA_MEASUREMENT_ID
}

/**
 * Join a pathname and a search string without dropping "?".
 * `search` may be "", "tab=about", or "?tab=about".
 */
export function buildPagePath(pathname: string, search?: string | null): string {
  const path = pathname && pathname.startsWith('/') ? pathname : `/${pathname || ''}`
  if (search == null) return path
  const query = search.startsWith('?') ? search.slice(1) : search
  if (!query) return path
  return `${path}?${query}`
}

export function gtagReady(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function'
}

function callGtag(...args: unknown[]) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') {
    pending.push(args)
    if (pending.length > MAX_PENDING) pending.shift()
    return
  }
  window.gtag(...args)
}

export function flushPendingGa4() {
  if (!gtagReady()) return
  const queued = pending.splice(0, pending.length)
  for (const args of queued) {
    window.gtag!(...args)
  }
}

function cleanAttribution(input: unknown): AttributionParams {
  if (!input || typeof input !== 'object') return {}
  const out: AttributionParams = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(key.toLowerCase())) continue
    if (typeof value === 'string') {
      if (value.includes('@')) continue
      if (WALLET_ADDRESS.test(value)) continue
      out[key] = value
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
    }
  }
  return out
}

function sanitize(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (BLOCKED_KEYS.has(key.toLowerCase())) continue
    if (value === undefined || value === null) continue
    out[key] = value
  }
  return out
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function transactionIdFromReceipt(receipt: unknown): string | undefined {
  if (!receipt || typeof receipt !== 'object') return undefined
  const record = receipt as { transactionHash?: unknown; hash?: unknown }
  const hash = record.transactionHash || record.hash
  return typeof hash === 'string' && TX_HASH.test(hash) ? hash : undefined
}

function sendEvent(name: string, params: Record<string, unknown>, includeAttribution: boolean) {
  const body = includeAttribution ? { ...getAttribution(), ...sanitize(params) } : sanitize(params)
  callGtag('event', name, body)
}

export function trackJoinCtaClick(params: { cta_location: string; plan: AnalyticsPlan }) {
  if (!params.cta_location) return
  sendEvent('join_cta_click', { cta_location: params.cta_location, plan: params.plan }, false)
}

export function trackBeginCheckout(params: {
  plan: AnalyticsPlan
  payment_method: PaymentMethod
  value_eth: number
  value: number
}) {
  const valueEth = finiteNumber(params.value_eth)
  const value = finiteNumber(params.value)
  if (valueEth === undefined || value === undefined) return
  sendEvent(
    'begin_checkout',
    {
      plan: params.plan,
      payment_method: params.payment_method,
      value_eth: valueEth,
      currency: 'USD',
      value,
    },
    false
  )
}

export function normalizeWalletType(raw: string | null | undefined): string {
  const compact = (raw || '').toLowerCase().replace(/[\s-]+/g, '_')
  if (!compact) return 'unknown'
  if (compact === 'privy' || compact.includes('embedded')) return 'embedded'
  if (compact === 'coinbase_wallet' || compact === 'coinbase') return 'coinbase'
  if (compact.includes('walletconnect') || compact === 'wallet_connect') return 'walletconnect'
  if (compact === 'metamask') return 'metamask'
  return compact
}

export function trackWalletConnect(walletType: string | null | undefined) {
  sendEvent('wallet_connect', { wallet_type: normalizeWalletType(walletType) }, false)
}

export function trackMintSuccess(params: {
  plan: AnalyticsPlan
  value_eth: number
  value: number
  transaction_id?: string
  payment_method: PaymentMethod
}) {
  const valueEth = finiteNumber(params.value_eth)
  const value = finiteNumber(params.value)
  if (valueEth === undefined || value === undefined) return
  const transactionId =
    params.transaction_id && TX_HASH.test(params.transaction_id) ? params.transaction_id : undefined
  const itemName = params.plan === 'citizen' ? 'Citizenship' : 'Team'
  const shared: Record<string, unknown> = {
    plan: params.plan,
    value_eth: valueEth,
    value,
    currency: 'USD',
    payment_method: params.payment_method,
  }
  if (transactionId) shared.transaction_id = transactionId
  const eventName = params.plan === 'citizen' ? 'citizen_mint_success' : 'team_mint_success'
  sendEvent(eventName, shared, true)
  sendEvent(
    'purchase',
    {
      ...(transactionId ? { transaction_id: transactionId } : {}),
      value,
      currency: 'USD',
      items: [{ item_id: params.plan, item_name: itemName, price: value }],
    },
    true
  )
}

export function trackMissionContribution(params: {
  mission_id: string
  value_eth: number
  value: number
  transaction_id?: string
  payment_method: PaymentMethod
}) {
  const valueEth = finiteNumber(params.value_eth)
  const value = finiteNumber(params.value)
  if (valueEth === undefined || value === undefined || !params.mission_id) return
  const transactionId =
    params.transaction_id && TX_HASH.test(params.transaction_id) ? params.transaction_id : undefined
  sendEvent(
    'mission_contribution',
    {
      mission_id: params.mission_id,
      value_eth: valueEth,
      value,
      currency: 'USD',
      payment_method: params.payment_method,
      ...(transactionId ? { transaction_id: transactionId } : {}),
    },
    false
  )
}

export function trackSignUp(params: { cta_location: string }) {
  if (!params.cta_location) return
  sendEvent('sign_up', { method: 'kit', cta_location: params.cta_location }, false)
}

export function trackExtendCitizenshipOpen(params: { surface: string }) {
  if (!params.surface) return
  sendEvent('extend_citizenship_open', { plan: 'citizen', surface: params.surface }, true)
}

export function trackExtendCitizenshipSubmit(params: {
  years: number
  value_eth?: number
  value?: number
}) {
  const years = finiteNumber(params.years)
  if (years === undefined || years < 1) return
  const valueEth = finiteNumber(params.value_eth)
  const value = finiteNumber(params.value)
  sendEvent(
    'extend_citizenship_submit',
    {
      plan: 'citizen',
      years,
      ...(valueEth !== undefined ? { value_eth: valueEth } : {}),
      ...(value !== undefined ? { currency: 'USD', value } : {}),
    },
    true
  )
}

export function trackExtendCitizenshipSuccess(params: {
  years: number
  value_eth?: number
  value?: number
  transaction_id?: string
}) {
  const years = finiteNumber(params.years)
  if (years === undefined || years < 1) return
  const valueEth = finiteNumber(params.value_eth)
  const value = finiteNumber(params.value)
  const transactionId =
    params.transaction_id && TX_HASH.test(params.transaction_id) ? params.transaction_id : undefined
  sendEvent(
    'extend_citizenship_success',
    {
      plan: 'citizen',
      years,
      ...(valueEth !== undefined ? { value_eth: valueEth } : {}),
      ...(value !== undefined ? { currency: 'USD', value } : {}),
      ...(transactionId ? { transaction_id: transactionId } : {}),
    },
    true
  )
}

export function trackExtendCitizenshipError(params: { error_type: string; step: string }) {
  if (!params.error_type || !params.step) return
  sendEvent(
    'extend_citizenship_error',
    { plan: 'citizen', error_type: params.error_type, step: params.step },
    true
  )
}

export function trackMintError(params: {
  plan?: AnalyticsPlan
  mission_id?: string
  error_type: string
  step: string
}) {
  if (!params.error_type || !params.step) return
  sendEvent(
    'mint_error',
    {
      ...(params.plan ? { plan: params.plan } : {}),
      ...(params.mission_id ? { mission_id: params.mission_id } : {}),
      error_type: params.error_type,
      step: params.step,
    },
    true
  )
}

export function classifyMintError(error: unknown): string {
  const err = (error || {}) as {
    message?: string
    shortMessage?: string
    reason?: string
    code?: number | string
  }
  const raw = `${err.shortMessage || ''} ${err.reason || ''} ${err.message || ''}`.toLowerCase()
  if (
    err.code === 4001 ||
    err.code === 'ACTION_REJECTED' ||
    raw.includes('user rejected') ||
    raw.includes('user denied') ||
    raw.includes('rejected the request')
  ) {
    return 'rejected'
  }
  if (raw.includes('insufficient')) return 'insufficient_funds'
  if (raw.includes('declin')) return 'card_declined'
  if (
    raw.includes('network') ||
    raw.includes('timeout') ||
    raw.includes('timed out') ||
    raw.includes('failed to fetch') ||
    raw.includes('buffer')
  ) {
    return 'network'
  }
  return 'unknown'
}

export type ProposalVoteStage = 'senate' | 'member'
export type ProposalVoteSurface = 'projects_list' | 'proposal_page' | 'modal'

export function trackProposalVote(
  proposalId: string | number | null | undefined,
  context?: {
    vote_stage?: ProposalVoteStage
    surface?: ProposalVoteSurface
  }
) {
  if (proposalId === undefined || proposalId === null || proposalId === '') return
  sendEvent(
    'proposal_vote',
    {
      proposal_id: String(proposalId),
      ...(context?.vote_stage ? { vote_stage: context.vote_stage } : {}),
      ...(context?.surface ? { surface: context.surface } : {}),
    },
    false
  )
}

export function setIsCitizen(isCitizen: boolean) {
  callGtag('set', 'user_properties', { is_citizen: isCitizen ? 'true' : 'false' })
}

export function planForJoinHref(href: string | null | undefined): AnalyticsPlan | null {
  const path = pathnameFromHref(href || '')
  if (path === '/team') return 'team'
  if (path === '/join' || path === '/citizen') return 'citizen'
  return null
}

export function ctaLocationFromContext(context: {
  explicit?: string | null
  pathname?: string
  inFooter?: boolean
  inNav?: boolean
  inHero?: boolean
}): string {
  const explicit = (context.explicit || '').trim()
  if (explicit) return explicit
  const pathname = context.pathname || ''
  if (pathname === '/linktree') return 'linktree'
  if (pathname === '/mission/4' || pathname === '/frank') return 'mission4'
  if (context.inFooter) return 'footer'
  if (context.inNav) return 'nav'
  if (context.inHero) return 'hero'
  return 'page'
}

export function joinCtaParams(
  href: string | null | undefined,
  context: {
    explicit?: string | null
    pathname?: string
    inFooter?: boolean
    inNav?: boolean
    inHero?: boolean
  }
): { cta_location: string; plan: AnalyticsPlan } | null {
  const plan = planForJoinHref(href)
  if (!plan) return null
  return { plan, cta_location: ctaLocationFromContext(context) }
}

function pathnameFromHref(href: string): string | null {
  const trimmed = href.trim()
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.toLowerCase().startsWith('mailto:') ||
    trimmed.toLowerCase().startsWith('javascript:')
  ) {
    return null
  }
  let path = trimmed
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    try {
      const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
      const host = url.hostname.toLowerCase()
      if (host !== 'moondao.com' && host !== 'www.moondao.com') return null
      path = url.pathname
    } catch {
      return null
    }
  } else {
    path = trimmed.split('#')[0].split('?')[0]
  }
  if (!path.startsWith('/')) return null
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

/** Capture clicks on anchors whose path is /join, /citizen, or /team. */
export function bindJoinCtaClicks(doc: Document = document): () => void {
  if (typeof doc === 'undefined' || typeof doc.addEventListener !== 'function') {
    return () => {}
  }
  const onClick = (event: Event) => {
    const node = event.target
    if (!node || !(node instanceof Element)) return
    const anchor = node.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    const marked = anchor.closest('[data-cta-location]')
    const params = joinCtaParams(href, {
      explicit: marked?.getAttribute('data-cta-location'),
      pathname,
      inFooter: Boolean(anchor.closest('footer, #expanded-menu')),
      inNav: Boolean(anchor.closest('nav, header')),
      inHero: Boolean(anchor.closest('#hero-section, [data-hero]')),
    })
    if (!params) return
    trackJoinCtaClick(params)
  }
  doc.addEventListener('click', onClick, true)
  return () => doc.removeEventListener('click', onClick, true)
}

/**
 * Inline snippet: consent defaults, then one gtag config (default send_page_view, once).
 * Exempt regions (US and territories) start granted. Everyone else starts denied.
 * A stored cookie_consent choice, the same 'true' / 'false' strings CookieBanner
 * writes with JSON.stringify, is applied before config so the landing page_view
 * is not sent as a cookieless ping for someone who already chose.
 * Does not set page_path, so the hit keeps location.search (the "?" ).
 * Enhanced Measurement then records later history changes.
 * `?internal=1` sets a cookie; the cookie adds traffic_type internal.
 */
export function buildGtagInitScript(measurementId: string): string {
  const id = safeMeasurementId(measurementId)
  const regions = JSON.stringify([...COOKIE_CONSENT_EXEMPT_REGIONS])
  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'default', { 'analytics_storage': 'granted', 'region': ${regions} });
    gtag('consent', 'default', { 'analytics_storage': 'denied', 'wait_for_update': 500 });
    try {
      var cc = localStorage.getItem('cookie_consent');
      if (cc === 'true') gtag('consent', 'update', { 'analytics_storage': 'granted' });
      else if (cc === 'false') gtag('consent', 'update', { 'analytics_storage': 'denied' });
    } catch (e) {}
    try {
      var search = window.location.search || '';
      if (new URLSearchParams(search).get('${INTERNAL_QUERY_PARAM}') === '1') {
        document.cookie = '${INTERNAL_COOKIE_NAME}=1; Path=/; Max-Age=31536000; SameSite=Lax';
      }
    } catch (e) {}
    var config = {};
    if ((document.cookie || '').split(';').some(function (part) {
      return part.trim() === '${INTERNAL_COOKIE_NAME}=1';
    })) {
      config.traffic_type = 'internal';
    }
    gtag('config', '${id}', config);
  `
}
