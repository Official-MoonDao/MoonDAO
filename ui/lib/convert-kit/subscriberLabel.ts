/** Rounded public label. Safe to import from a page. No API key. */

export const SUBSCRIBER_COUNT_REVALIDATE_SECONDS = 60 * 60 * 24
export const FALLBACK_SUBSCRIBER_LABEL = '12,000+'

/** Round down to a clean figure: 8234 -> "8,000+". */
export function formatSubscriberLabel(count: number): string | null {
  if (!Number.isFinite(count) || count < 100) return null
  const step = count >= 1000 ? 1000 : 100
  const floored = Math.floor(count / step) * step
  if (floored < 100) return null
  return `${floored.toLocaleString('en-US')}+`
}

export function subscriberTotalFromKitBody(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const record = body as {
    pagination?: { total_count?: unknown }
    total_count?: unknown
  }
  const raw = record.pagination?.total_count ?? record.total_count
  const count = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(count) ? count : null
}
