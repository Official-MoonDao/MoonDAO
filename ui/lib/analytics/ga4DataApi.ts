import { createSign } from 'crypto'

// Server-only reader for the GA4 Data API. Authenticates as a Google Cloud
// service account that has Viewer access on the GA4 property. Credentials come
// from env so nothing sensitive ships to the browser:
//   GA4_PROPERTY_ID           numeric property ID (not the G-XXXX measurement ID)
//   GA4_SERVICE_ACCOUNT_JSON  the service account key file, raw JSON or base64

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const CACHE_TTL_MS = 10 * 60 * 1000

export const RANGE_DAYS = { '7d': 7, '28d': 28, '90d': 90 } as const
export type RangeKey = keyof typeof RANGE_DAYS

export const TRACKED_EVENTS: { name: string; label: string; description: string }[] = [
  {
    name: 'join_cta_click',
    label: 'Join button clicks',
    description: 'Clicks on any "Join" call to action',
  },
  {
    name: 'begin_checkout',
    label: 'Checkouts started',
    description: 'Opened the Citizen or Team mint checkout',
  },
  { name: 'purchase', label: 'Purchases', description: 'Completed Citizen or Team mints' },
  { name: 'citizen_mint_success', label: 'Citizens minted', description: 'New Citizenship NFTs' },
  { name: 'team_mint_success', label: 'Teams created', description: 'New Team NFTs' },
  {
    name: 'mission_contribution',
    label: 'Mission contributions',
    description: 'Contributions to Launchpad missions',
  },
  { name: 'sign_up', label: 'Newsletter sign-ups', description: 'Email sign-ups' },
  { name: 'wallet_connect', label: 'Wallets connected', description: 'Wallet connections' },
  { name: 'proposal_vote', label: 'Proposal votes', description: 'Votes cast on proposals' },
  { name: 'mint_error', label: 'Checkout errors', description: 'Failed or rejected mint attempts' },
]

type Credentials = { client_email: string; private_key: string }

type ReportRequest = Record<string, unknown>
type ReportRow = {
  dimensionValues?: { value: string }[]
  metricValues?: { value: string }[]
}
type ReportResponse = {
  dimensionHeaders?: { name: string }[]
  metricHeaders?: { name: string }[]
  rows?: ReportRow[]
}

export type ParsedRow = {
  dims: Record<string, string>
  metrics: Record<string, number>
  dateRange?: string
}

export function getMissingConfig(): string[] {
  const missing: string[] = []
  if (!process.env.GA4_PROPERTY_ID) missing.push('GA4_PROPERTY_ID')
  if (!process.env.GA4_SERVICE_ACCOUNT_JSON) missing.push('GA4_SERVICE_ACCOUNT_JSON')
  return missing
}

function readCredentials(): Credentials {
  const raw = (process.env.GA4_SERVICE_ACCOUNT_JSON || '').trim()
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(json)
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GA4_SERVICE_ACCOUNT_JSON is missing client_email or private_key')
  }
  return {
    client_email: parsed.client_email,
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
  }
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString('base64url')

let cachedToken: { token: string; expiresAt: number } | null = null
let pendingToken: Promise<string> | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token
  if (!pendingToken) {
    pendingToken = fetchAccessToken().finally(() => {
      pendingToken = null
    })
  }
  return pendingToken
}

async function fetchAccessToken(): Promise<string> {
  const { client_email, private_key } = readCredentials()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({ iss: client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const assertion = `${header}.${claims}.${base64url(signer.sign(private_key))}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Google auth failed: ${json?.error_description || json?.error || res.status}`)
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return cachedToken.token
}

async function callApi<T>(method: string, body: unknown): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${API_BASE}/properties/${process.env.GA4_PROPERTY_ID}:${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`GA4 ${method} failed: ${json?.error?.message || res.status}`)
  }
  return json as T
}

// The API caps a batch at 5 reports.
async function batchRunReports(requests: ReportRequest[]): Promise<ReportResponse[]> {
  const chunks: ReportRequest[][] = []
  for (let i = 0; i < requests.length; i += 5) chunks.push(requests.slice(i, i + 5))
  const results = await Promise.all(
    chunks.map((chunk) =>
      callApi<{ reports: ReportResponse[] }>('batchRunReports', { requests: chunk })
    )
  )
  return results.flatMap((r) => r.reports || [])
}

export function parseReport(report: ReportResponse | undefined): ParsedRow[] {
  if (!report?.rows) return []
  const dimNames = (report.dimensionHeaders || []).map((h) => h.name)
  const metricNames = (report.metricHeaders || []).map((h) => h.name)
  return report.rows.map((row) => {
    const dims: Record<string, string> = {}
    dimNames.forEach((name, i) => (dims[name] = row.dimensionValues?.[i]?.value ?? ''))
    const metrics: Record<string, number> = {}
    metricNames.forEach((name, i) => (metrics[name] = Number(row.metricValues?.[i]?.value ?? 0)))
    return { dims, metrics, dateRange: dims.dateRange }
  })
}

function dateRanges(days: number, compare: boolean) {
  const current = { startDate: `${days - 1}daysAgo`, endDate: 'today', name: 'current' }
  if (!compare) return [current]
  return [
    current,
    { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo`, name: 'previous' },
  ]
}

const SUMMARY_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'screenPageViews',
  'engagementRate',
  'averageSessionDuration',
  'keyEvents',
  'totalRevenue',
]

function topBy(dimension: string, metrics: string[], days: number, limit: number) {
  return {
    dateRanges: dateRanges(days, false),
    dimensions: [{ name: dimension }],
    metrics: metrics.map((name) => ({ name })),
    orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
    limit,
  }
}

export type AnalyticsReport = Awaited<ReturnType<typeof buildReport>>

async function buildReport(range: RangeKey) {
  const days = RANGE_DAYS[range]
  const requests: ReportRequest[] = [
    { dateRanges: dateRanges(days, true), metrics: SUMMARY_METRICS.map((name) => ({ name })) },
    {
      dateRanges: dateRanges(days, false),
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 400,
    },
    topBy('pagePath', ['screenPageViews', 'activeUsers', 'userEngagementDuration'], days, 15),
    topBy('sessionDefaultChannelGroup', ['sessions', 'activeUsers', 'engagementRate'], days, 10),
    {
      dateRanges: dateRanges(days, true),
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: TRACKED_EVENTS.map((e) => e.name) },
        },
      },
    },
    topBy('sessionSourceMedium', ['sessions', 'activeUsers'], days, 10),
    topBy('country', ['activeUsers', 'sessions'], days, 10),
    topBy('deviceCategory', ['activeUsers', 'sessions'], days, 5),
    topBy('landingPage', ['sessions', 'engagementRate', 'keyEvents'], days, 10),
  ]

  const [reports, realtime] = await Promise.all([
    batchRunReports(requests),
    callApi<ReportResponse>('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }).catch(
      () => null
    ),
  ])
  const [summary, daily, pages, channels, events, sources, countries, devices, landing] =
    reports.map(parseReport)

  const summaryFor = (name: string) =>
    summary.find((r) => r.dateRange === name)?.metrics ??
    Object.fromEntries(SUMMARY_METRICS.map((m) => [m, 0]))

  const eventTotals = TRACKED_EVENTS.map((event) => {
    const rowFor = (dr: string) =>
      events.find((r) => r.dims.eventName === event.name && r.dateRange === dr)?.metrics
    return {
      ...event,
      count: rowFor('current')?.eventCount ?? 0,
      users: rowFor('current')?.totalUsers ?? 0,
      previousCount: rowFor('previous')?.eventCount ?? 0,
    }
  })

  return {
    range,
    days,
    generatedAt: new Date().toISOString(),
    realtimeActiveUsers: realtime ? parseReport(realtime)[0]?.metrics.activeUsers ?? 0 : null,
    summary: { current: summaryFor('current'), previous: summaryFor('previous') },
    daily: daily.map((r) => ({
      date: r.dims.date,
      users: r.metrics.activeUsers,
      sessions: r.metrics.sessions,
      views: r.metrics.screenPageViews,
    })),
    pages: pages.map((r) => ({
      path: r.dims.pagePath,
      views: r.metrics.screenPageViews,
      users: r.metrics.activeUsers,
      avgEngagementSec: r.metrics.activeUsers
        ? r.metrics.userEngagementDuration / r.metrics.activeUsers
        : 0,
    })),
    channels: channels.map((r) => ({
      name: r.dims.sessionDefaultChannelGroup,
      sessions: r.metrics.sessions,
      users: r.metrics.activeUsers,
      engagementRate: r.metrics.engagementRate,
    })),
    sources: sources.map((r) => ({
      name: r.dims.sessionSourceMedium,
      sessions: r.metrics.sessions,
      users: r.metrics.activeUsers,
    })),
    countries: countries.map((r) => ({ name: r.dims.country, users: r.metrics.activeUsers })),
    devices: devices.map((r) => ({ name: r.dims.deviceCategory, users: r.metrics.activeUsers })),
    landingPages: landing.map((r) => ({
      path: r.dims.landingPage,
      sessions: r.metrics.sessions,
      engagementRate: r.metrics.engagementRate,
      keyEvents: r.metrics.keyEvents,
    })),
    events: eventTotals,
  }
}

const cache = new Map<RangeKey, { at: number; data: AnalyticsReport }>()

export async function getAnalyticsReport(range: RangeKey, fresh = false) {
  const hit = cache.get(range)
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  const data = await buildReport(range)
  cache.set(range, { at: Date.now(), data })
  return data
}
