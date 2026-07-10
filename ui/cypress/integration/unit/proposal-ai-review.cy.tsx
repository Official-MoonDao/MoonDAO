/**
 * Unit tests for Senate-style AI proposal review (MVP).
 *
 * Covers three layers:
 *   1. Pure helpers (novelty detection, JSON extraction, prompt building).
 *   2. The normalizer's deterministic hard rules (budget cap, novelty,
 *      score clamping, missing-dimension defaults, vote downgrades, dedupe).
 *   3. `performGroqReview` end-to-end with a mocked Groq fetch (success and
 *      every failure branch), verifying the exact response shape.
 */
import {
  AI_REVIEW_MODEL,
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  extractJsonObject,
  hasNoveltySection,
  normalizeReviewResult,
  performGroqReview,
  type DimensionKey,
} from '@/lib/proposals/aiReview'

const QUARTERLY_MAX = 4682

function makeDims(score: number) {
  const keys: DimensionKey[] = [
    'mission',
    'team',
    'objectives',
    'budget',
    'impact',
    'feasibility',
    'accountability',
    'fiduciary',
  ]
  return keys.map((key) => ({ key, score, note: `${key} ok` }))
}

const NOVELTY_BODY = '## Novelty & Prior Art\n\nPrior work: NASA X. New: Y. Why not existing: Z.'

describe('proposal AI review — helpers', () => {
  it('detects Novelty & Prior Art section (and variants)', () => {
    expect(hasNoveltySection('## Novelty & Prior Art\n\nStuff')).to.eq(true)
    expect(hasNoveltySection('### novelty and prior art')).to.eq(true)
    expect(hasNoveltySection('Novelty  &  Prior  Art')).to.eq(true)
    expect(hasNoveltySection('## Abstract\n\nHello')).to.eq(false)
    expect(hasNoveltySection('we are novel')).to.eq(false)
  })

  it('extracts JSON from fenced, prefixed, and raw responses', () => {
    expect(extractJsonObject('{"a":1}')).to.deep.eq({ a: 1 })
    expect(extractJsonObject('```json\n{"a":2}\n```')).to.deep.eq({ a: 2 })
    expect(extractJsonObject('Here is the review:\n{"a":3}\nThanks')).to.deep.eq({ a: 3 })
    expect(extractJsonObject('```\n{"a":{"b":4}}\n```')).to.deep.eq({ a: { b: 4 } })
  })

  it('throws when there is no JSON object', () => {
    expect(() => extractJsonObject('no json here')).to.throw()
  })

  it('embeds the quarterly max in prompts', () => {
    expect(buildReviewSystemPrompt(QUARTERLY_MAX)).to.contain(String(QUARTERLY_MAX))
    const user = buildReviewUserPrompt({
      title: 'T',
      body: 'B',
      quarterlyMaxUsd: QUARTERLY_MAX,
      budgetHintUsd: 3000,
    })
    expect(user).to.contain(String(QUARTERLY_MAX))
    expect(user).to.contain('$3000')
    expect(user).to.contain('T')
  })
})

describe('proposal AI review — normalizer hard rules', () => {
  it('forces budget ≤2 and rewrite when ask exceeds max', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        askUsd: 9000,
        dimensions: makeDims(8),
        hardFlags: [],
        topIssues: ['Trim budget'],
        conditions: [],
        finding: 'Looks fine',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })

    expect(review.askWithinMax).to.eq(false)
    expect(review.dimensions.find((d) => d.key === 'budget')?.score).to.be.at.most(2)
    expect(review.provisionalVote).to.eq('Request rewrite')
    expect(review.hardFlags.some((f) => /exceeds quarterly max/i.test(f))).to.eq(true)
    expect(review.advisory).to.eq(true)
    expect(review.model).to.eq(AI_REVIEW_MODEL)
  })

  it('flags missing Novelty & Prior Art and caps impact ≤3', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        askUsd: 2000,
        dimensions: makeDims(7),
        hardFlags: [],
        topIssues: [],
        conditions: [],
        finding: 'Missing novelty',
      },
      body: '## Abstract\n\nNo novelty section here.',
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })

    expect(review.dimensions.find((d) => d.key === 'impact')?.score).to.be.at.most(3)
    expect(review.hardFlags.some((f) => /novelty/i.test(f))).to.eq(true)
    expect(review.provisionalVote).to.not.eq('Approve')
  })

  it('keeps a clean proposal as Approve', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        askUsd: 3000,
        dimensions: makeDims(8),
        hardFlags: [],
        topIssues: [],
        conditions: [],
        finding: 'Strong pack.',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })

    expect(review.provisionalVote).to.eq('Approve')
    expect(review.hardFlags).to.have.length(0)
    expect(review.askWithinMax).to.eq(true)
    expect(review.average).to.eq(8)
  })

  it('preserves a Reject verdict from the model', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Reject',
        askUsd: 4000,
        dimensions: makeDims(2),
        hardFlags: ['Tax bailout'],
        topIssues: ['Withdraw'],
        conditions: [],
        finding: 'No mission tie.',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })
    expect(review.provisionalVote).to.eq('Reject')
    // Every low dimension should surface as a hard flag.
    expect(review.hardFlags.length).to.be.greaterThan(1)
  })

  it('clamps out-of-range scores to 1..10 integers', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve with conditions',
        askUsd: 1000,
        dimensions: [
          { key: 'mission', score: 99, note: '' },
          { key: 'team', score: -5, note: '' },
          { key: 'objectives', score: 7.6, note: '' },
        ],
        hardFlags: [],
        topIssues: [],
        conditions: ['x'],
        finding: 'f',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })
    const byKey = Object.fromEntries(review.dimensions.map((d) => [d.key, d.score]))
    expect(byKey.mission).to.eq(10)
    expect(byKey.team).to.eq(1)
    expect(byKey.objectives).to.eq(8) // rounded
    // Missing dimensions default to a neutral 5.
    expect(byKey.fiduciary).to.eq(5)
    expect(review.dimensions).to.have.length(8)
  })

  it('falls back to the budget hint when the model omits askUsd', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        dimensions: makeDims(8),
        hardFlags: [],
        topIssues: [],
        conditions: [],
        finding: 'f',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      budgetHintUsd: 12000,
      model: AI_REVIEW_MODEL,
    })
    expect(review.askUsd).to.eq(12000)
    expect(review.askWithinMax).to.eq(false)
    expect(review.provisionalVote).to.eq('Request rewrite')
  })

  it('does not emit duplicate hard flags', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Reject',
        askUsd: 9000,
        dimensions: makeDims(2),
        hardFlags: ['Ask exceeds quarterly max ($4682).', 'ASK EXCEEDS QUARTERLY MAX ($4682).'],
        topIssues: [],
        conditions: [],
        finding: 'f',
      },
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      model: AI_REVIEW_MODEL,
    })
    const lower = review.hardFlags.map((f) => f.toLowerCase())
    expect(new Set(lower).size).to.eq(lower.length)
  })
})

describe('performGroqReview — mocked Groq', () => {
  const validModelJson = JSON.stringify({
    provisionalVote: 'Approve with conditions',
    askUsd: 2900,
    dimensions: makeDims(6),
    hardFlags: [],
    topIssues: ['Add key results'],
    conditions: ['Fill empty Key Results'],
    finding: 'Solid but incomplete.',
  })

  function mockFetch(response: { ok: boolean; body: any }) {
    return async () => ({
      ok: response.ok,
      json: async () => response.body,
    })
  }

  it('returns a normalized review on success', async () => {
    const outcome = await performGroqReview({
      title: 'LunCoSim',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      budgetHintUsd: 2900,
      apiKey: 'test-key',
      fetchImpl: mockFetch({
        ok: true,
        body: { choices: [{ message: { content: validModelJson } }] },
      }),
    })

    expect(outcome.ok).to.eq(true)
    if (outcome.ok) {
      expect(outcome.review.provisionalVote).to.eq('Approve with conditions')
      expect(outcome.review.askUsd).to.eq(2900)
      expect(outcome.review.dimensions).to.have.length(8)
      expect(outcome.review.advisory).to.eq(true)
      expect(outcome.review.conditions).to.include('Fill empty Key Results')
    }
  })

  it('parses model output wrapped in markdown fences', async () => {
    const outcome = await performGroqReview({
      title: 'T',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'test-key',
      fetchImpl: mockFetch({
        ok: true,
        body: { choices: [{ message: { content: '```json\n' + validModelJson + '\n```' } }] },
      }),
    })
    expect(outcome.ok).to.eq(true)
  })

  it('maps provider errors to 502', async () => {
    const outcome = await performGroqReview({
      title: 'T',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'bad-key',
      fetchImpl: mockFetch({ ok: false, body: { error: { message: 'invalid_api_key' } } }),
    })
    expect(outcome.ok).to.eq(false)
    if (!outcome.ok) {
      expect(outcome.status).to.eq(502)
      expect(outcome.error).to.contain('invalid_api_key')
    }
  })

  it('errors when the model returns empty content', async () => {
    const outcome = await performGroqReview({
      title: 'T',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'test-key',
      fetchImpl: mockFetch({ ok: true, body: { choices: [{ message: { content: '' } }] } }),
    })
    expect(outcome.ok).to.eq(false)
    if (!outcome.ok) expect(outcome.status).to.eq(502)
  })

  it('errors when the model returns non-JSON content', async () => {
    const outcome = await performGroqReview({
      title: 'T',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'test-key',
      fetchImpl: mockFetch({
        ok: true,
        body: { choices: [{ message: { content: 'I cannot help with that.' } }] },
      }),
    })
    expect(outcome.ok).to.eq(false)
    if (!outcome.ok) {
      expect(outcome.status).to.eq(502)
      expect(outcome.error).to.contain('invalid JSON')
    }
  })

  it('handles a network/fetch throw as a 500', async () => {
    const outcome = await performGroqReview({
      title: 'T',
      body: NOVELTY_BODY,
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'test-key',
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })
    expect(outcome.ok).to.eq(false)
    if (!outcome.ok) {
      expect(outcome.status).to.eq(500)
      expect(outcome.error).to.contain('network down')
    }
  })

  it('applies deterministic hard rules to a real-looking model response', async () => {
    // Model over-scores an over-budget proposal with no novelty section.
    const overBudgetJson = JSON.stringify({
      provisionalVote: 'Approve',
      askUsd: 5500,
      dimensions: makeDims(8),
      hardFlags: [],
      topIssues: [],
      conditions: [],
      finding: 'Model was too generous.',
    })
    const outcome = await performGroqReview({
      title: 'MDRS analog seat',
      body: '## Abstract\n\nNo novelty section, over budget.',
      quarterlyMaxUsd: QUARTERLY_MAX,
      apiKey: 'test-key',
      fetchImpl: mockFetch({
        ok: true,
        body: { choices: [{ message: { content: overBudgetJson } }] },
      }),
    })

    expect(outcome.ok).to.eq(true)
    if (outcome.ok) {
      // Guardrails override the model's optimism.
      expect(outcome.review.provisionalVote).to.eq('Request rewrite')
      expect(outcome.review.askWithinMax).to.eq(false)
      expect(outcome.review.dimensions.find((d) => d.key === 'budget')?.score).to.be.at.most(2)
      expect(outcome.review.dimensions.find((d) => d.key === 'impact')?.score).to.be.at.most(3)
    }
  })
})
