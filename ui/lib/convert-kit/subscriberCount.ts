/**
 * Active Kit subscriber count for /join-us.
 *
 * Server-only. Import this from getStaticProps, not from a client component.
 * Optional v4 key: KIT_V4_API_KEY, then CONVERT_KIT_V4_API_KEY.
 * Otherwise the v3 secret already used by pages/api/newsletters.ts:
 * CONVERT_KIT_API_SECRET, then CONVERT_KIT_API_KEY.
 * Do not prefix any of these with NEXT_PUBLIC_. The page only receives a label.
 * Do not log a secret or a URL that contains one.
 */
import {
  FALLBACK_SUBSCRIBER_LABEL,
  formatSubscriberLabel,
  subscriberTotalFromKitBody,
} from '@/lib/convert-kit/subscriberLabel'

const KIT_V4_SUBSCRIBERS =
  'https://api.kit.com/v4/subscribers?status=active&include_total_count=true&per_page=1'

/**
 * Kit's published v3 list returns total_subscribers. The documented sample
 * is active subscribers only, and the page does not say other states are
 * included. subscriber_state=active keeps the count on that list if the
 * account default is wider. A non-active state on the returned page means
 * the total is not active-only, so it is ignored.
 */
const KIT_V3_SUBSCRIBERS = 'https://api.convertkit.com/v3/subscribers'

export function kitV4ApiKey(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const primary = env.KIT_V4_API_KEY?.trim()
  if (primary) return primary
  const fallback = env.CONVERT_KIT_V4_API_KEY?.trim()
  return fallback || undefined
}

/** Same order as the v3 secret in pages/api/newsletters.ts. */
export function kitV3ApiSecret(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const primary = env.CONVERT_KIT_API_SECRET?.trim()
  if (primary) return primary
  const fallback = env.CONVERT_KIT_API_KEY?.trim()
  return fallback || undefined
}

export function activeTotalFromV3Body(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { total_subscribers?: unknown; subscribers?: unknown }
  if (Array.isArray(record.subscribers)) {
    for (const entry of record.subscribers) {
      if (!entry || typeof entry !== 'object') continue
      const state = (entry as { state?: unknown }).state
      if (typeof state === 'string' && state.toLowerCase() !== 'active') return null
    }
  }
  const raw = record.total_subscribers
  const count = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(count) ? count : null
}

export async function fetchActiveSubscriberLabel(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const v4Key = kitV4ApiKey(env)
  if (v4Key) {
    const fromV4 = await labelFromV4(v4Key, fetchImpl)
    if (fromV4) return fromV4
  }
  const v3Secret = kitV3ApiSecret(env)
  if (v3Secret) {
    const fromV3 = await labelFromV3(v3Secret, fetchImpl)
    if (fromV3) return fromV3
  }
  return FALLBACK_SUBSCRIBER_LABEL
}

async function labelFromV4(apiKey: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(KIT_V4_SUBSCRIBERS, {
      headers: { 'X-Kit-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const body = await response.json()
    const total = subscriberTotalFromKitBody(body)
    if (total === null) return null
    return formatSubscriberLabel(total) || FALLBACK_SUBSCRIBER_LABEL
  } catch {
    return null
  }
}

async function labelFromV3(apiSecret: string, fetchImpl: typeof fetch): Promise<string | null> {
  const params = new URLSearchParams({
    api_secret: apiSecret,
    subscriber_state: 'active',
  })
  try {
    const response = await fetchImpl(`${KIT_V3_SUBSCRIBERS}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const body = await response.json()
    const total = activeTotalFromV3Body(body)
    if (total === null) return null
    return formatSubscriberLabel(total) || FALLBACK_SUBSCRIBER_LABEL
  } catch {
    return null
  }
}
