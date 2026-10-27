import { extractJsonObject } from '@/lib/proposals/aiReview'
import type { ActivitySnapshot } from './collectActivity'
import {
  ACTIVITY_SUMMARY_MODEL,
  ActivitySummary,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  normalizeSummary,
} from './prompt'

type MinimalResponse = {
  ok: boolean
  json: () => Promise<any>
}

type FetchImpl = (url: string, init: any) => Promise<MinimalResponse>

export type SummaryOutcome = { ok: true; summary: ActivitySummary } | { ok: false; error: string }

/**
 * Asks Groq to summarize a snapshot. The network client is injectable so this
 * can be unit-tested without a live API key, matching performGroqReview.
 */
export async function generateActivitySummary(params: {
  snapshot: ActivitySnapshot
  apiKey: string
  model?: string
  fetchImpl?: FetchImpl
  now?: Date
}): Promise<SummaryOutcome> {
  const model = params.model || ACTIVITY_SUMMARY_MODEL
  const doFetch: FetchImpl = params.fetchImpl || (fetch as unknown as FetchImpl)

  let res: MinimalResponse
  try {
    res = await doFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSummarySystemPrompt() },
          { role: 'user', content: buildSummaryUserPrompt(params.snapshot) },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    })
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Summary request failed.' }
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: 'Summary provider returned a non-JSON response.' }
  }

  if (!res.ok) {
    return { ok: false, error: data?.error?.message || 'Summary provider returned an error.' }
  }

  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) return { ok: false, error: 'Summary provider returned an empty response.' }

  let parsed: unknown
  try {
    parsed = extractJsonObject(text)
  } catch {
    return { ok: false, error: 'Summary provider returned invalid JSON.' }
  }

  const summary = normalizeSummary({
    raw: parsed,
    snapshot: params.snapshot,
    model,
    now: params.now,
  })
  if (!summary) return { ok: false, error: 'Summary had no usable sections.' }

  return { ok: true, summary }
}
