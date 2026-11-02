import { fetchGa4AccessToken } from '@/lib/analytics/ga4DataApi'

const ADMIN_SCOPE = 'https://www.googleapis.com/auth/analytics.edit'
const ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta'

export const ENTRY_PATH_DIMENSION = {
  parameterName: 'entry_path',
  displayName: 'Entry path',
  description: 'Pathname of the first page in this browser session.',
  scope: 'EVENT',
} as const

type JsonResponse = {
  ok: boolean
  status: number
  json: () => Promise<any>
}

type AdminClient = (url: string, init?: RequestInit) => Promise<JsonResponse>

/**
 * Registers the event-scoped entry_path dimension used by forecast_submitted.
 * Idempotent: an existing event-scoped parameter is left as it is.
 * GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON are read from the environment.
 * The service account needs Editor on the property; Viewer cannot create dimensions.
 */
export async function ensureEntryPathDimension(options?: {
  fetchImpl?: AdminClient
  propertyId?: string
  accessToken?: string
}): Promise<{ created: boolean; name: string }> {
  const propertyId = options?.propertyId || process.env.GA4_PROPERTY_ID || ''
  if (!propertyId) throw new Error('GA4_PROPERTY_ID is not set')
  if (!/^\d+$/.test(propertyId)) {
    throw new Error('GA4_PROPERTY_ID must be the numeric property id')
  }
  const fetchImpl: AdminClient = options?.fetchImpl || fetch
  const token = options?.accessToken || (await fetchGa4AccessToken(ADMIN_SCOPE))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let pageToken = ''
  let pages = 0
  do {
    pages += 1
    if (pages > 10) throw new Error('GA4 custom dimension list did not finish')
    const url = new URL(`${ADMIN_BASE}/properties/${propertyId}/customDimensions`)
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const listRes = await fetchImpl(url.toString(), { headers })
    const listJson = await listRes.json()
    if (!listRes.ok) {
      throw new Error(
        `GA4 custom dimension list failed: ${listJson?.error?.message || listRes.status}`
      )
    }
    const existing = (listJson.customDimensions || []).find(
      (dim: { parameterName?: string; scope?: string; name?: string }) =>
        dim.parameterName === ENTRY_PATH_DIMENSION.parameterName && dim.scope === 'EVENT'
    )
    if (existing) return { created: false, name: existing.name || '' }
    pageToken = listJson.nextPageToken || ''
  } while (pageToken)

  const createRes = await fetchImpl(`${ADMIN_BASE}/properties/${propertyId}/customDimensions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(ENTRY_PATH_DIMENSION),
  })
  const created = await createRes.json()
  if (createRes.status === 409) return { created: false, name: created?.error?.status || '' }
  if (!createRes.ok) {
    throw new Error(
      `GA4 custom dimension create failed: ${created?.error?.message || createRes.status}`
    )
  }
  return { created: true, name: created.name || '' }
}
