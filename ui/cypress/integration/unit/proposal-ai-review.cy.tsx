/**
 * Unit tests for Senate-style AI proposal review normalizer (MVP).
 */
import {
  hasNoveltySection,
  normalizeReviewResult,
} from '@/lib/proposals/aiReview'

describe('proposal AI review normalizer', () => {
  const quarterlyMaxUsd = 4682

  it('detects Novelty & Prior Art section', () => {
    expect(hasNoveltySection('## Novelty & Prior Art\n\nStuff')).to.eq(true)
    expect(hasNoveltySection('## Abstract\n\nHello')).to.eq(false)
  })

  it('forces budget ≤2 and rewrite when ask exceeds max', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        askUsd: 9000,
        dimensions: [
          { key: 'mission', score: 8, note: 'ok' },
          { key: 'team', score: 8, note: 'ok' },
          { key: 'objectives', score: 8, note: 'ok' },
          { key: 'budget', score: 8, note: 'ok' },
          { key: 'impact', score: 8, note: 'ok' },
          { key: 'feasibility', score: 8, note: 'ok' },
          { key: 'accountability', score: 8, note: 'ok' },
          { key: 'fiduciary', score: 8, note: 'ok' },
        ],
        hardFlags: [],
        topIssues: ['Trim budget'],
        conditions: [],
        finding: 'Looks fine',
      },
      body: '## Novelty & Prior Art\n\nPrior work exists.',
      quarterlyMaxUsd,
      model: 'openai/gpt-oss-120b',
    })

    expect(review.askWithinMax).to.eq(false)
    expect(review.dimensions.find((d) => d.key === 'budget')?.score).to.be.at.most(2)
    expect(review.provisionalVote).to.eq('Request rewrite')
    expect(review.hardFlags.some((f) => /exceeds quarterly max/i.test(f))).to.eq(true)
    expect(review.advisory).to.eq(true)
  })

  it('flags missing Novelty & Prior Art and caps impact ≤3', () => {
    const review = normalizeReviewResult({
      raw: {
        provisionalVote: 'Approve',
        askUsd: 2000,
        dimensions: [
          { key: 'mission', score: 7, note: 'ok' },
          { key: 'team', score: 7, note: 'ok' },
          { key: 'objectives', score: 7, note: 'ok' },
          { key: 'budget', score: 7, note: 'ok' },
          { key: 'impact', score: 7, note: 'ok' },
          { key: 'feasibility', score: 7, note: 'ok' },
          { key: 'accountability', score: 7, note: 'ok' },
          { key: 'fiduciary', score: 7, note: 'ok' },
        ],
        hardFlags: [],
        topIssues: [],
        conditions: [],
        finding: 'Missing novelty',
      },
      body: '## Abstract\n\nNo novelty section here.',
      quarterlyMaxUsd,
      model: 'openai/gpt-oss-120b',
    })

    expect(review.dimensions.find((d) => d.key === 'impact')?.score).to.be.at.most(3)
    expect(review.hardFlags.some((f) => /novelty/i.test(f))).to.eq(true)
    expect(review.provisionalVote).to.not.eq('Approve')
  })
})
