/// <reference types="node" />
/**
 * Acceptance: scoring a single standing allocation.
 *
 * There is no revision history any more, so a forecast is scored once against
 * the resolved payout vector. Ranking is on skill rather than raw Brier,
 * because skill scores a uniform allocation at exactly zero — spreading evenly
 * to avoid ever looking wrong has to earn nothing.
 */
// brier.ts already exists, so import it directly and reach for the new export
// through `any` — that keeps compilation working before scoreAllocation lands.
import * as brierModule from '@/lib/forecasts/brier'

const REQUEST = '@/lib/forecasts/brier'
const CLOSE = 1e-9

function requireExports(mod: any, request: string, names: string[]): void {
  const missing = names.filter((name) => typeof mod?.[name] === 'undefined')
  if (missing.length > 0) {
    throw new Error(`[not implemented] "${request}" must export: ${missing.join(', ')}`)
  }
}

describe('deprize forecast scoring', () => {
  let mod: any

  before(() => {
    mod = brierModule as any
    requireExports(mod, REQUEST, [
      'brierScore',
      'brierSkillScore',
      'uniformBaselineBrier',
      'scoreAllocation',
    ])
  })

  it('scores a correct all-in call perfectly', () => {
    const { scoreAllocation } = mod
    const scored = scoreAllocation([100, 0, 0], [1, 0, 0])
    expect(scored.brier).to.be.closeTo(0, CLOSE)
    expect(scored.skill).to.be.closeTo(1, CLOSE)
  })

  it('scores a uniform allocation at exactly zero skill', () => {
    const { scoreAllocation } = mod
    const scored = scoreAllocation([33, 33, 34], [1, 0, 0])
    expect(scored.skill).to.be.closeTo(0, 1e-3)
  })

  it('punishes a confidently wrong call below the uniform baseline', () => {
    const { scoreAllocation } = mod
    const scored = scoreAllocation([0, 100, 0], [1, 0, 0])
    expect(scored.brier).to.be.closeTo(2, CLOSE)
    expect(scored.skill).to.be.closeTo(-2, CLOSE)
  })

  it('rewards a hedged split that leaned the right way', () => {
    const { scoreAllocation } = mod
    const scored = scoreAllocation([60, 40], [1, 0])
    expect(scored.brier).to.be.closeTo(0.32, CLOSE)
    expect(scored.skill).to.be.closeTo(0.36, CLOSE)
  })

  it('ranks hedging above being confidently wrong', () => {
    const { scoreAllocation } = mod
    const hedged = scoreAllocation([50, 50], [1, 0])
    const wrong = scoreAllocation([0, 100], [1, 0])
    const right = scoreAllocation([100, 0], [1, 0])
    expect(right.skill).to.be.greaterThan(hedged.skill)
    expect(hedged.skill).to.be.greaterThan(wrong.skill)
  })

  it('treats percentages and fractions as the same allocation', () => {
    const { scoreAllocation } = mod
    const asPercent = scoreAllocation([60, 40], [1, 0])
    const asFraction = scoreAllocation([0.6, 0.4], [1, 0])
    expect(asFraction.brier).to.be.closeTo(asPercent.brier, CLOSE)
  })

  it('has no skill to report on a refund resolution', () => {
    const { scoreAllocation } = mod
    const scored = scoreAllocation([60, 40], [0.5, 0.5])
    expect(scored.skill).to.equal(null)
  })

  it('returns null rather than throwing when there is nothing to score against', () => {
    const { scoreAllocation } = mod
    expect(scoreAllocation([60, 40], null)).to.equal(null)
    expect(scoreAllocation([60, 40], [1, 0, 0])).to.equal(null)
  })
})
