/**
 * Shared types + prompt for Senate-style AI proposal review (MVP).
 * Rubric mirrors the MoonDAO Senate Proposal Review Pack (Appendix A).
 */

export type ProvisionalVote =
  | 'Approve'
  | 'Approve with conditions'
  | 'Request rewrite'
  | 'Reject'

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

export const AI_REVIEW_MODEL = 'openai/gpt-oss-120b'

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
  return /novelty\s*(&|and)?\s*prior\s*art/i.test(body)
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
  if (
    (askUsd == null || askUsd <= 0) &&
    params.budgetHintUsd != null &&
    params.budgetHintUsd > 0
  ) {
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
  if (overMax && provisionalVote === 'Approve') {
    provisionalVote = 'Request rewrite'
  }
  if (hasHard && provisionalVote === 'Approve') {
    provisionalVote = 'Approve with conditions'
  }

  const average =
    Math.round(
      (dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length) * 10
    ) / 10

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
    topIssues:
      topIssues.length > 0
        ? topIssues
        : hardFlags.slice(0, 3).map((f) => `Fix: ${f}`),
    conditions: provisionalVote === 'Approve with conditions' ? conditions : conditions.slice(0, 3),
    finding,
    advisory: true,
    model: params.model,
  }
}
