/**
 * Active Kit subscriber count for /join-us.
 *
 * Server-only. Import this from getStaticProps, not from a client component.
 * Set KIT_V4_API_KEY in Vercel (a Kit v4 key). CONVERT_KIT_V4_API_KEY is
 * accepted as a fallback because town hall jobs already use that name.
 * Do not prefix either name with NEXT_PUBLIC_. The page only receives a label.
 */
import {
  FALLBACK_SUBSCRIBER_LABEL,
  formatSubscriberLabel,
  subscriberTotalFromKitBody,
} from '@/lib/convert-kit/subscriberLabel'

const KIT_SUBSCRIBERS =
  'https://api.kit.com/v4/subscribers?status=active&include_total_count=true&per_page=1'

export function kitV4ApiKey(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const primary = env.KIT_V4_API_KEY?.trim()
  if (primary) return primary
  const fallback = env.CONVERT_KIT_V4_API_KEY?.trim()
  return fallback || undefined
}

export async function fetchActiveSubscriberLabel(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const apiKey = kitV4ApiKey(env)
  if (!apiKey) return FALLBACK_SUBSCRIBER_LABEL
  try {
    const response = await fetchImpl(KIT_SUBSCRIBERS, {
      headers: { 'X-Kit-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return FALLBACK_SUBSCRIBER_LABEL
    const body = await response.json()
    const label = formatSubscriberLabel(subscriberTotalFromKitBody(body) ?? NaN)
    return label || FALLBACK_SUBSCRIBER_LABEL
  } catch {
    return FALLBACK_SUBSCRIBER_LABEL
  }
}
