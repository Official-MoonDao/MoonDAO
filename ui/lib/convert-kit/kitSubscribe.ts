import { kitSignupFields } from '@/lib/analytics/attribution'

const KIT_FORM_SUBSCRIBE = 'https://api.convertkit.com/v3/forms'
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504])

export type KitSubscribeResult = {
  ok: boolean
  status: number
  droppedFields: string[]
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Kit v3 form subscribe. Unknown custom fields reject the whole call, so a
 * named field is removed and retried. Transient errors retry with backoff.
 * `reactivate` is never sent, so someone who unsubscribed stays unsubscribed.
 * The returned status is 200, 400, or 502. The response body is not returned.
 */
export async function subscribeEmailToKit(input: {
  email: string
  formId: string
  fields?: Record<string, string>
  apiKey: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  log?: (event: string, detail: Record<string, unknown>) => void
}): Promise<KitSubscribeResult> {
  const fetchImpl = input.fetchImpl || fetch
  const sleep = input.sleep || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const log = input.log || (() => {})
  let fields = input.fields && Object.keys(input.fields).length ? { ...input.fields } : undefined
  const dropped = new Set<string>()
  let transientTries = 0
  let unknownTries = 0

  while (transientTries < 3 && unknownTries < 6) {
    let response: Response
    try {
      response = await fetchImpl(`${KIT_FORM_SUBSCRIBE}/${input.formId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitPayload(input.apiKey, input.email, fields)),
      })
    } catch {
      transientTries += 1
      log('kit_network_error', { attempt: transientTries, fieldKeys: fieldKeys(fields) })
      if (transientTries >= 3) return { ok: false, status: 502, droppedFields: [...dropped] }
      await sleep(200 * transientTries)
      continue
    }

    if (response.ok) {
      return { ok: true, status: 200, droppedFields: [...dropped] }
    }

    const body = await response.text().catch(() => '')
    log('kit_response', {
      status: response.status,
      fieldKeys: fieldKeys(fields),
      body: redactKitBody(body),
    })

    if (TRANSIENT_STATUSES.has(response.status)) {
      transientTries += 1
      if (transientTries >= 3) return { ok: false, status: 502, droppedFields: [...dropped] }
      await sleep(200 * transientTries)
      continue
    }

    if (fields && isUnknownFieldError(response.status, body)) {
      unknownTries += 1
      const next = dropUnknownFields(fields, body)
      const removed = Object.keys(fields).filter((key) => !next || !(key in next))
      removed.forEach((key) => dropped.add(key))
      log('kit_dropped_fields', { fieldKeys: removed })
      fields = next
      continue
    }

    if (response.status >= 400 && response.status < 500) {
      return { ok: false, status: 400, droppedFields: [...dropped] }
    }
    return { ok: false, status: 502, droppedFields: [...dropped] }
  }

  return { ok: false, status: 502, droppedFields: [...dropped] }
}

export function kitPayload(
  apiKey: string,
  email: string,
  fields?: Record<string, string>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { api_key: apiKey, email }
  if (fields && Object.keys(fields).length) payload.fields = fields
  return payload
}

export function redactKitBody(body: string): string {
  return body
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/api_key["']?\s*[:=]\s*["'][^"']+["']/gi, 'api_key:[redacted]')
    .slice(0, 400)
}

export function fieldsFromRequestBody(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object') return undefined
  return kitSignupFields(input as Record<string, string>)
}

function fieldKeys(fields?: Record<string, string>): string[] {
  return fields ? Object.keys(fields) : []
}

function isUnknownFieldError(status: number, body: string): boolean {
  if (status !== 400 && status !== 422) return false
  return /custom field/i.test(body)
}

function dropUnknownFields(
  fields: Record<string, string>,
  body: string
): Record<string, string> | undefined {
  const lower = body.toLowerCase()
  const kept: Record<string, string> = {}
  let named = false
  for (const [key, value] of Object.entries(fields)) {
    if (lower.includes(key.toLowerCase())) {
      named = true
      continue
    }
    kept[key] = value
  }
  if (!named) return undefined
  return Object.keys(kept).length ? kept : undefined
}
