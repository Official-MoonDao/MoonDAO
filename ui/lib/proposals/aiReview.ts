/**
 * Shared types + prompt for Senate-style AI proposal review (MVP).
 * Rubric mirrors the MoonDAO Senate Proposal Review Pack (Appendix A).
 */

export type ProvisionalVote = 'Approve' | 'Approve with conditions' | 'Request rewrite' | 'Reject'

export type DimensionKey =
  | 'mission'
  | 'team'
  | 'objectives'
  | 'budget'
  | 'impact'
  | 'feasibility'
  | 'accountability'
  | 'fiduciary'

export type DimensionScore = {
  key: DimensionKey
  label: string
  score: number
  note: string
}

export type ProposalAIReviewResult = {
  provisionalVote: ProvisionalVote
  average: number
  askUsd: number | null
  askWithinMax: boolean | null
  dimensions: DimensionScore[]
  hardFlags: string[]
  topIssues: string[]
  conditions: string[]
  finding: string
  advisory: true
  model: string
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  mission: 'Mission/Constitution',
  team: 'Team',
  objectives: 'Objectives/Deliverables',
  budget: 'Budget',
  impact: 'Impact/Novelty',
  feasibility: 'Feasibility',
  accountability: 'Accountability/IP',
  fiduciary: 'Fiduciary DD',
}

const DIMENSION_KEYS: DimensionKey[] = [
  'mission',
  'team',
  'objectives',
  'budget',
  'impact',
  'feasibility',
  'accountability',
  'fiduciary',
]

export type AIReviewProvider = 'kimi' | 'groq'

/**
 * Provider registry. Both endpoints speak the OpenAI chat-completions dialect.
 * - kimi: Moonshot AI's Kimi K3 (released Jul 2026). Reasoning is always on and
 *   sampling params (temperature/top_p/penalties) are FIXED server-side — the
 *   API rejects/ignores overrides, so we must omit them.
 * - groq: fallback. Groq deprecated its hosted Kimi K2 models in Apr 2026 and
 *   routed users to gpt-oss-120b, which is what we run there.
 */
export const AI_REVIEW_PROVIDERS: Record<
  AIReviewProvider,
  { url: string; model: string; sendSamplingParams: boolean }
> = {
  kimi: {
    url: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'kimi-k3',
    sendSamplingParams: false,
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    sendSamplingParams: true,
  },
}

export const AI_REVIEW_MODEL = AI_REVIEW_PROVIDERS.groq.model
export const KIMI_REVIEW_MODEL = AI_REVIEW_PROVIDERS.kimi.model

export function buildReviewSystemPrompt(quarterlyMaxUsd: number): string {
  return `You are an impersonal MoonDAO Senate proposal reviewer. Score proposals using the official Senate review rubric. Be strict, evidence-tied, and concise. This review is ADVISORY only — not a Senate vote.

CORE FUNDING RULE
Pay for mission outputs and specialized tools the work uniquely needs. Do not fund: general computers/monitors/printers/furniture; LLC/sole-prop formation; tax bills, re-registration, or private runway bailouts.

EIGHT DIMENSIONS (score each 1–10; average = overall)
1. mission — lunar settlement by 2030; values; community standing; one ask/quarter.
2. team — same-type prior delivery; not résumé-only.
3. objectives — SMART; accurate claims; no setup-as-objective; no megaproject OKRs in the grant.
4. budget — ≤ $${quarterlyMaxUsd}; classify spend; foundational/setup gear and entity fees should score ≤3 until removed. Over max → budget ≤2.
5. impact — prior art map; what's new; why not existing work. Require Novelty & Prior Art honesty.
6. feasibility — timeline; method risk (no stranger-Zoom technical design).
7. accountability — reporting; IP disclosed (open default or explicit retention).
8. fiduciary — COI structure; partner proof; no false history claims.

HARD FLAGS
- Any dimension ≤3 is a hard flag.
- Ask > $${quarterlyMaxUsd} → budget ≤2 and provisionalVote must be "Request rewrite" or "Reject" until cut.
- Missing Novelty & Prior Art section (what exists / what's new / why not use existing) is a hard flag on impact.
- Foundational PC / LLC fees / tax bailouts → hard flag.

PROVISIONAL VOTE LABELS (pick exactly one)
- Approve
- Approve with conditions
- Request rewrite
- Reject

OUTPUT
Return ONLY valid JSON (no markdown fences) matching this schema:
{
  "provisionalVote": "Approve" | "Approve with conditions" | "Request rewrite" | "Reject",
  "askUsd": number | null,
  "dimensions": [
    { "key": "mission"|"team"|"objectives"|"budget"|"impact"|"feasibility"|"accountability"|"fiduciary", "score": 1-10, "note": "≤20 words evidence" }
  ],
  "hardFlags": ["short flag strings"],
  "topIssues": ["up to 3 author-facing fixes"],
  "conditions": ["up to 3 conditions if Approve with conditions, else []"],
  "finding": "1-3 sentence impersonal finding"
}

Rules:
- Include ALL 8 dimension keys exactly once.
- Scores are integers 1–10.
- topIssues must be actionable for the author.
- Do not invent citations; if prior art is missing, say so.`
}

export function buildReviewUserPrompt(params: {
  title: string
  body: string
  quarterlyMaxUsd: number
  budgetHintUsd?: number | null
}): string {
  const budgetLine =
    params.budgetHintUsd != null && params.budgetHintUsd > 0
      ? `Structured budget hint (from form/parser): $${params.budgetHintUsd} USD\n`
      : ''

  return (
    `Quarterly per-proposal maximum: $${params.quarterlyMaxUsd}\n` +
    budgetLine +
    `Title: ${params.title}\n\n` +
    `Proposal markdown:\n${params.body}`
  )
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.max(1, Math.min(10, Math.round(v)))
}

function asStringArray(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, max)
}

function parseVote(raw: unknown): ProvisionalVote {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (s === 'Approve') return 'Approve'
  if (s === 'Approve with conditions') return 'Approve with conditions'
  if (s === 'Reject') return 'Reject'
  return 'Request rewrite'
}

export function hasNoveltySection(body: string): boolean {
  return /novelty\s*(&|and)?\s*prior\s*art|prior\s*art\s*(&|and)?\s*novelty/i.test(body)
}

export function extractJsonObject(text: string): unknown {
  let clean = text.trim()
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) clean = fenced[1].trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object in model response')
  }
  return JSON.parse(clean.slice(start, end + 1))
}

export type AIReviewOutcome =
  { ok: true; review: ProposalAIReviewResult } | { ok: false; status: number; error: string }

type MinimalResponse = {
  ok: boolean
  json: () => Promise<any>
}

type FetchImpl = (url: string, init: any) => Promise<MinimalResponse>

/**
 * Calls the configured provider's chat-completions endpoint and returns a
 * normalized review. The network client is injectable so this can be
 * unit-tested without a live API key. Returns a discriminated outcome so the
 * API route can map failures to HTTP status codes without try/catch
 * gymnastics.
 */
export async function performAIReview(params: {
  title: string
  body: string
  quarterlyMaxUsd: number
  budgetHintUsd?: number | null
  apiKey: string
  provider?: AIReviewProvider
  model?: string
  fetchImpl?: FetchImpl
}): Promise<AIReviewOutcome> {
  const providerConfig = AI_REVIEW_PROVIDERS[params.provider || 'groq']
  const model = params.model || providerConfig.model
  const doFetch: FetchImpl = params.fetchImpl || (fetch as unknown as FetchImpl)

  const requestBody: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildReviewSystemPrompt(params.quarterlyMaxUsd) },
      {
        role: 'user',
        content: buildReviewUserPrompt({
          title: params.title,
          body: params.body,
          quarterlyMaxUsd: params.quarterlyMaxUsd,
          budgetHintUsd: params.budgetHintUsd,
        }),
      },
    ],
  }
  // Kimi K3 fixes temperature/top_p server-side and rejects overrides; only
  // pin temperature on providers that accept it.
  if (providerConfig.sendSamplingParams) {
    requestBody.temperature = 0
  }

  let res: MinimalResponse
  try {
    res = await doFetch(providerConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })
  } catch (e: any) {
    return { ok: false, status: 500, error: e?.message || 'AI review request failed.' }
  }

  let data: any
  try {
    data = await res.json()
  } catch (e) {
    return { ok: false, status: 502, error: 'AI review returned a non-JSON response.' }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: 502,
      error: data?.error?.message || 'AI review provider returned an error.',
    }
  }

  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    return { ok: false, status: 502, error: 'AI review returned an empty response.' }
  }

  let parsed: unknown
  try {
    parsed = extractJsonObject(text)
  } catch (e) {
    return { ok: false, status: 502, error: 'AI review returned invalid JSON.' }
  }

  const review = normalizeReviewResult({
    raw: parsed,
    body: params.body,
    quarterlyMaxUsd: params.quarterlyMaxUsd,
    budgetHintUsd: params.budgetHintUsd,
    model,
  })

  return { ok: true, review }
}

export function normalizeReviewResult(params: {
  raw: unknown
  body: string
  quarterlyMaxUsd: number
  budgetHintUsd?: number | null
  model: string
}): ProposalAIReviewResult {
  const raw = (params.raw && typeof params.raw === 'object' ? params.raw : {}) as Record<
    string,
    unknown
  >

  const dimMap = new Map<DimensionKey, { score: number; note: string }>()
  const rawDims = Array.isArray(raw.dimensions) ? raw.dimensions : []
  for (const item of rawDims) {
    if (!item || typeof item !== 'object') continue
    const d = item as Record<string, unknown>
    const key = d.key as DimensionKey
    if (!DIMENSION_KEYS.includes(key)) continue
    dimMap.set(key, {
      score: clampScore(d.score),
      note: typeof d.note === 'string' ? d.note.trim().slice(0, 200) : '',
    })
  }

  let askUsd: number | null =
    typeof raw.askUsd === 'number' && Number.isFinite(raw.askUsd) ? raw.askUsd : null
  if ((askUsd == null || askUsd <= 0) && params.budgetHintUsd != null && params.budgetHintUsd > 0) {
    askUsd = params.budgetHintUsd
  }

  const hardFlags = asStringArray(raw.hardFlags, 8)
  const topIssues = asStringArray(raw.topIssues, 3)
  const conditions = asStringArray(raw.conditions, 3)

  // Deterministic hard rules
  if (askUsd != null && askUsd > params.quarterlyMaxUsd) {
    const existing = dimMap.get('budget')
    dimMap.set('budget', {
      score: Math.min(existing?.score ?? 2, 2),
      note:
        existing?.note ||
        `Ask $${Math.round(askUsd)} exceeds quarterly max $${params.quarterlyMaxUsd}.`,
    })
    if (!hardFlags.some((f) => /over|exceed|max/i.test(f))) {
      hardFlags.unshift(`Ask exceeds quarterly max ($${params.quarterlyMaxUsd}).`)
    }
  }

  if (!hasNoveltySection(params.body)) {
    const existing = dimMap.get('impact')
    dimMap.set('impact', {
      score: Math.min(existing?.score ?? 3, 3),
      note: existing?.note || 'Missing Novelty & Prior Art section.',
    })
    if (!hardFlags.some((f) => /novelty|prior art/i.test(f))) {
      hardFlags.unshift('Missing Novelty & Prior Art section.')
    }
  }

  const dimensions: DimensionScore[] = DIMENSION_KEYS.map((key) => {
    const found = dimMap.get(key)
    return {
      key,
      label: DIMENSION_LABELS[key],
      score: found?.score ?? 5,
      note: found?.note || '',
    }
  })

  // Any ≤3 is a hard flag
  for (const d of dimensions) {
    if (d.score <= 3 && !hardFlags.some((f) => f.toLowerCase().includes(d.label.toLowerCase()))) {
      hardFlags.push(`${d.label} ≤3 (${d.score}).`)
    }
  }

  let provisionalVote = parseVote(raw.provisionalVote)
  const overMax = askUsd != null && askUsd > params.quarterlyMaxUsd
  const hasHard = hardFlags.length > 0 || dimensions.some((d) => d.score <= 3)
  if (overMax && (provisionalVote === 'Approve' || provisionalVote === 'Approve with conditions')) {
    provisionalVote = 'Request rewrite'
  }
  if (hasHard && provisionalVote === 'Approve') {
    provisionalVote = 'Approve with conditions'
  }

  // Dedupe hard flags case-insensitively, preserving first-seen order.
  const seenFlags = new Set<string>()
  const dedupedFlags = hardFlags.filter((f) => {
    const key = f.trim().toLowerCase()
    if (!key || seenFlags.has(key)) return false
    seenFlags.add(key)
    return true
  })
  hardFlags.length = 0
  hardFlags.push(...dedupedFlags)

  const average =
    Math.round((dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length) * 10) / 10

  const finding =
    typeof raw.finding === 'string' && raw.finding.trim()
      ? raw.finding.trim().slice(0, 600)
      : 'Advisory review complete. Address hard flags before Senate discussion.'

  return {
    provisionalVote,
    average,
    askUsd,
    askWithinMax: askUsd == null ? null : askUsd <= params.quarterlyMaxUsd,
    dimensions,
    hardFlags: hardFlags.slice(0, 8),
    topIssues: topIssues.length > 0 ? topIssues : hardFlags.slice(0, 3).map((f) => `Fix: ${f}`),
    conditions: provisionalVote === 'Approve with conditions' ? conditions : [],
    finding,
    advisory: true,
    model: params.model,
  }
}
