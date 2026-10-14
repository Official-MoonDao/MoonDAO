/**
 * First-party campaign attribution for the join and citizen funnel.
 *
 * Import getAttribution() and spread it into GA4 event params:
 *   { ...getAttribution(), ...eventParams }
 * Unprefixed keys are the last touch. first_* keys are the first touch.
 * The object is empty on the server, when analytics consent is missing, and
 * when nothing has been stored.
 */

export const ATTRIBUTION_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'wbraid',
  'gbraid',
] as const

export type AttributionParamKey = (typeof ATTRIBUTION_PARAM_KEYS)[number]

export const ATTRIBUTION_COOKIE_NAME = 'md_attribution'
export const ATTRIBUTION_STORAGE_KEY = 'md_attribution'
export const CONSENT_STORAGE_KEY = 'cookie_consent'
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
export const ATTRIBUTION_TTL_MS = ATTRIBUTION_MAX_AGE_SECONDS * 1000

const MAX_PARAM_LENGTH = 512
const MAX_PATH_LENGTH = 300
const MAX_REFERRER_LENGTH = 300
const FUNNEL_PATHS = new Set(['/join', '/citizen', '/team'])

export type AttributionTouch = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  fbclid?: string
  wbraid?: string
  gbraid?: string
  landing_page: string
  referrer: string
  captured_at: number
}

export type StoredAttribution = {
  v: 1
  first: AttributionTouch
  last: AttributionTouch
  expires_at: number
}

export type FlatAttribution = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  fbclid?: string
  wbraid?: string
  gbraid?: string
  landing_page?: string
  referrer?: string
  first_utm_source?: string
  first_utm_medium?: string
  first_utm_campaign?: string
  first_utm_term?: string
  first_utm_content?: string
  first_gclid?: string
  first_fbclid?: string
  first_wbraid?: string
  first_gbraid?: string
  first_landing_page?: string
  first_referrer?: string
}

const FLAT_KEYS: (keyof FlatAttribution)[] = [
  ...ATTRIBUTION_PARAM_KEYS,
  'landing_page',
  'referrer',
  'first_utm_source',
  'first_utm_medium',
  'first_utm_campaign',
  'first_utm_term',
  'first_utm_content',
  'first_gclid',
  'first_fbclid',
  'first_wbraid',
  'first_gbraid',
  'first_landing_page',
  'first_referrer',
]

export type CaptureInput = {
  search: string
  path: string
  referrer: string
  origin: string
  now: number
  consent: boolean | null
  record: StoredAttribution | null
  memory: StoredAttribution | null
}

export type CaptureResult = {
  record: StoredAttribution | null
  memory: StoredAttribution | null
  persist: boolean
  clear: boolean
}

export type DecoratableUrl =
  | string
  | (Record<string, unknown> & { pathname?: string; query?: Record<string, unknown> })

let memoryRecord: StoredAttribution | null = null

export function resetAttributionForTests() {
  memoryRecord = null
}

export function sanitizeParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!value || value.length > MAX_PARAM_LENGTH) return undefined
  // Email addresses are PII. Campaign params never need an @.
  if (value.includes('@')) return undefined
  return value
}

export function sanitizeLandingPath(path: string): string {
  if (typeof path !== 'string') return '/'
  const bare = path.split('?')[0].split('#')[0].trim()
  if (!bare.startsWith('/') || bare.startsWith('//')) return '/'
  if (bare.includes('\\') || bare.includes('@')) return '/'
  return bare.slice(0, MAX_PATH_LENGTH)
}

export function sanitizeReferrer(referrer: string, currentOrigin = ''): string {
  if (!referrer || typeof referrer !== 'string') return ''
  try {
    const url = new URL(referrer)
    if (currentOrigin && url.origin === currentOrigin) return ''
    return `${url.origin}${url.pathname}`.slice(0, MAX_REFERRER_LENGTH)
  } catch {
    return ''
  }
}

export function extractAttributionParams(
  search: string
): Partial<Record<AttributionParamKey, string>> {
  const query = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(query)
  const extracted: Partial<Record<AttributionParamKey, string>> = {}
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = sanitizeParam(params.get(key) ?? '')
    if (value) extracted[key] = value
  }
  return extracted
}

export function hasAttributionParams(
  params: Partial<Record<AttributionParamKey, string>>
): boolean {
  return ATTRIBUTION_PARAM_KEYS.some((key) => Boolean(params[key]))
}

export function isFunnelPath(path: string): boolean {
  return FUNNEL_PATHS.has(path)
}

function touchFromParams(
  params: Partial<Record<AttributionParamKey, string>>,
  landingPage: string,
  referrer: string,
  now: number
): AttributionTouch {
  const touch: AttributionTouch = {
    landing_page: landingPage,
    referrer,
    captured_at: now,
  }
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    if (params[key]) touch[key] = params[key]
  }
  return touch
}

function sameCampaign(
  existing: AttributionTouch,
  incoming: Partial<Record<AttributionParamKey, string>>
): boolean {
  return ATTRIBUTION_PARAM_KEYS.every((key) => {
    const next = incoming[key]
    if (!next) return true
    return existing[key] === next
  })
}

/**
 * Empty incoming params (internal navigation) leave the active touch as-is.
 * A repeated campaign, including params copied onto the next funnel URL, does
 * too. A real new campaign replaces last touch and never writes blank fields.
 * First touch is set only when there is no active record.
 */
export function applyTouch(
  existing: StoredAttribution | null,
  incoming: Partial<Record<AttributionParamKey, string>>,
  landingPage: string,
  referrer: string,
  now: number
): StoredAttribution | null {
  const active = existing && existing.expires_at > now ? existing : null
  if (!hasAttributionParams(incoming)) return active
  if (active && sameCampaign(active.last, incoming)) return active

  const touch = touchFromParams(incoming, landingPage, referrer, now)
  const expires_at = now + ATTRIBUTION_TTL_MS
  if (!active) {
    return { v: 1, first: touch, last: touch, expires_at }
  }
  return { v: 1, first: active.first, last: touch, expires_at }
}

function serializeTouch(touch: AttributionTouch): AttributionTouch {
  const out: AttributionTouch = {
    landing_page: touch.landing_page,
    referrer: touch.referrer,
    captured_at: touch.captured_at,
  }
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    if (touch[key]) out[key] = touch[key]
  }
  return out
}

export function serializeRecord(record: StoredAttribution): string {
  return JSON.stringify({
    v: 1,
    first: serializeTouch(record.first),
    last: serializeTouch(record.last),
    expires_at: record.expires_at,
  })
}

function normalizeTouch(value: unknown, now: number): AttributionTouch | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  if (typeof src.captured_at !== 'number' || src.captured_at > now + 60_000) return null
  const touch: AttributionTouch = {
    landing_page: sanitizeLandingPath(
      typeof src.landing_page === 'string' ? src.landing_page : '/'
    ),
    referrer: sanitizeReferrer(typeof src.referrer === 'string' ? src.referrer : ''),
    captured_at: src.captured_at,
  }
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const clean = sanitizeParam(src[key])
    if (clean) touch[key] = clean
  }
  return touch
}

export function parseRecord(raw: string | null, now: number): StoredAttribution | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (!data || data.v !== 1) return null
    if (typeof data.expires_at !== 'number' || data.expires_at <= now) return null
    const first = normalizeTouch(data.first, now)
    const last = normalizeTouch(data.last, now)
    if (!first || !last) return null
    return { v: 1, first, last, expires_at: data.expires_at }
  } catch {
    return null
  }
}

export function reduceCapture(input: CaptureInput): CaptureResult {
  if (input.consent === false) {
    return { record: null, memory: null, persist: false, clear: true }
  }

  const params = extractAttributionParams(input.search)
  const path = sanitizeLandingPath(input.path)
  const referrer = sanitizeReferrer(input.referrer, input.origin)
  const base = input.consent === true ? input.record || input.memory : input.memory
  const next = applyTouch(base, params, path, referrer, input.now)

  if (input.consent === true) {
    const changed = serializeRecordOrEmpty(next) !== serializeRecordOrEmpty(input.record)
    return {
      record: next,
      memory: null,
      persist: Boolean(next) && changed,
      clear: !next && input.record !== null,
    }
  }

  return { record: null, memory: next, persist: false, clear: false }
}

function serializeRecordOrEmpty(record: StoredAttribution | null): string {
  return record ? serializeRecord(record) : ''
}

export function toFlatAttribution(record: StoredAttribution | null): FlatAttribution {
  if (!record) return {}
  const flat: FlatAttribution = {}
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const last = record.last[key]
    const first = record.first[key]
    if (last) flat[key] = last
    if (first) flat[`first_${key}`] = first
  }
  if (record.last.landing_page) flat.landing_page = record.last.landing_page
  if (record.first.landing_page) flat.first_landing_page = record.first.landing_page
  if (record.last.referrer) flat.referrer = record.last.referrer
  if (record.first.referrer) flat.first_referrer = record.first.referrer
  return flat
}

export function parseConsentValue(stored: string | null): boolean | null {
  if (stored === null) return null
  try {
    const parsed = JSON.parse(stored)
    if (parsed === true) return true
    if (parsed === false) return false
  } catch {
    return null
  }
  return null
}

export function buildAttributionCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  const secureAttr = secure ? '; Secure' : ''
  return `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureAttr}`
}

export function buildClearedAttributionCookie(): string {
  return `${ATTRIBUTION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function withAttribution(
  href: string,
  params: Partial<Record<AttributionParamKey, string>>
): string {
  if (!href || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  const hashIndex = href.indexOf('#')
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const queryIndex = withoutHash.indexOf('?')
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  if (!isFunnelPath(path)) return href

  const search = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '')
  let changed = false
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = params[key]
    if (!value || search.get(key)) continue
    search.set(key, value)
    changed = true
  }
  if (!changed) return href
  const qs = search.toString()
  return `${path}${qs ? `?${qs}` : ''}${hash}`
}

export function decorateRouterUrl<T extends DecoratableUrl>(
  url: T,
  params: Partial<Record<AttributionParamKey, string>>
): T {
  if (typeof url === 'string') return withAttribution(url, params) as T
  if (!url || typeof url !== 'object') return url
  const pathname = typeof url.pathname === 'string' ? url.pathname : undefined
  if (!pathname || !isFunnelPath(pathname)) return url

  const query: Record<string, unknown> = { ...(url.query || {}) }
  let changed = false
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = params[key]
    if (!value) continue
    const current = query[key]
    if (current == null || current === '') {
      query[key] = value
      changed = true
    }
  }
  if (!changed) return url
  return { ...url, query }
}

type QueryValue = string | string[] | undefined

export function mergeAttributionQuery(
  current: Record<string, QueryValue> | undefined,
  next: Record<string, QueryValue>
): Record<string, string | string[]> {
  const merged: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string' || Array.isArray(value)) merged[key] = value
  }
  const source = current || {}
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const existing = merged[key]
    if (typeof existing === 'string' && existing.trim()) continue
    if (Array.isArray(existing) && existing.some((item) => item.trim())) continue
    const raw = Array.isArray(source[key]) ? source[key][0] : source[key]
    const value = sanitizeParam(raw)
    if (value) merged[key] = value
  }
  return merged
}

export function typeformHiddenFields(flat: FlatAttribution): Record<string, string> {
  const hidden: Record<string, string> = {}
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = flat[key]
    if (value) hidden[key] = value
  }
  if (flat.landing_page) hidden.landing_page = flat.landing_page
  return hidden
}

export function typeformEmbedUrl(formId: string, flat: FlatAttribution): string {
  const base = `https://form.typeform.com/to/${encodeURIComponent(formId)}`
  const search = new URLSearchParams(typeformHiddenFields(flat))
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}

export function kitFieldsFromAttribution(
  flat: FlatAttribution
): Record<string, string> | undefined {
  return sanitizeKitFields(flat)
}

export function sanitizeKitFields(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object') return undefined
  const source = input as Record<string, unknown>
  const fields: Record<string, string> = {}
  for (const key of FLAT_KEYS) {
    const value = sanitizeParam(source[key])
    if (value) fields[key] = value
  }
  return Object.keys(fields).length ? fields : undefined
}

export function touchParams(
  touch: AttributionTouch | undefined
): Partial<Record<AttributionParamKey, string>> {
  const params: Partial<Record<AttributionParamKey, string>> = {}
  if (!touch) return params
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    if (touch[key]) params[key] = touch[key]
  }
  return params
}

function readLocalRaw(): string | null {
  try {
    return window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
  } catch {
    return null
  }
}

function readCookieRaw(name: string): string | null {
  try {
    const parts = document.cookie ? document.cookie.split('; ') : []
    for (const part of parts) {
      const index = part.indexOf('=')
      if (index === -1) continue
      if (part.slice(0, index) === name) return decodeURIComponent(part.slice(index + 1))
    }
  } catch {
    return null
  }
  return null
}

function readPersisted(now: number): StoredAttribution | null {
  const localRaw = readLocalRaw()
  const cookieRaw = readCookieRaw(ATTRIBUTION_COOKIE_NAME)
  const local = parseRecord(localRaw, now)
  const cookie = parseRecord(cookieRaw, now)
  if (local && cookie) {
    return local.last.captured_at >= cookie.last.captured_at ? local : cookie
  }
  const record = local || cookie
  if (!record && (localRaw || cookieRaw)) clearPersisted()
  return record
}

function writePersisted(record: StoredAttribution) {
  const raw = serializeRecord(record)
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, raw)
  } catch {
    // Private mode can reject storage. The cookie write below still runs.
  }
  try {
    const secure = window.location.protocol === 'https:'
    document.cookie = buildAttributionCookie(raw, ATTRIBUTION_MAX_AGE_SECONDS, secure)
  } catch {
    // Ignore cookie write failures.
  }
}

function clearPersisted() {
  try {
    window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
  try {
    document.cookie = buildClearedAttributionCookie()
  } catch {
    // Ignore cookie failures.
  }
}

export function readAnalyticsConsent(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    return parseConsentValue(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

function exposeGetAttribution() {
  window.getAttribution = getAttribution
}

export function getAttribution(): FlatAttribution {
  if (typeof window === 'undefined') return {}
  if (readAnalyticsConsent() !== true) return {}
  const record = readPersisted(Date.now())
  if (!record) return {}
  return toFlatAttribution(record)
}

export function getPassthroughParams(): Partial<Record<AttributionParamKey, string>> {
  if (typeof window === 'undefined') return {}
  const consent = readAnalyticsConsent()
  if (consent === false) return {}
  const now = Date.now()
  const record = consent === true ? readPersisted(now) : memoryRecord
  if (!record || record.expires_at <= now) return {}
  return touchParams(record.last)
}

export function captureClientAttribution(now = Date.now()): void {
  if (typeof window === 'undefined') return
  exposeGetAttribution()
  try {
    const consent = readAnalyticsConsent()
    const record = consent === true ? readPersisted(now) : null
    const result = reduceCapture({
      search: window.location.search,
      path: window.location.pathname,
      referrer: document.referrer,
      origin: window.location.origin,
      now,
      consent,
      record,
      memory: memoryRecord,
    })
    memoryRecord = result.memory
    if (result.clear) clearPersisted()
    else if (result.persist && result.record) writePersisted(result.record)
  } catch {
    // Attribution must not break the page.
  }
}

export function applyConsentToAttribution(granted: boolean): void {
  if (typeof window === 'undefined') return
  exposeGetAttribution()
  if (!granted) {
    memoryRecord = null
    clearPersisted()
    return
  }
  captureClientAttribution()
}

declare global {
  interface Window {
    getAttribution?: () => FlatAttribution
  }
}
