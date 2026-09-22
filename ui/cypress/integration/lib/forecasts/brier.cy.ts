import {
  brierScore,
  brierSkillScore,
  crowdAggregate,
  snapshotBrier,
  uniformBaselineBrier,
} from '@/lib/forecasts/brier'
import { serializeLatest } from '@/lib/forecasts/weights'

describe('brier math', () => {
  it('perfect forecast vs one-hot → Brier 0', () => {
    expect(brierScore([1, 0, 0], [1, 0, 0])).to.equal(0)
    expect(snapshotBrier([1, 0, 0], [1, 0, 0])).to.equal(0)
    expect(snapshotBrier([1, 0], null)).to.equal(null)
    expect(snapshotBrier([1, 0], [1])).to.equal(null)
  })

  it('uniform on 3 outcomes vs one-hot is 2/3 (unnormalized Σ; do not fix to 1/N-averaged)', () => {
    const score = brierScore([1 / 3, 1 / 3, 1 / 3], [1, 0, 0])
    expect(score).to.be.closeTo(2 / 3, 1e-12)
    expect(uniformBaselineBrier([1, 0, 0])).to.be.closeTo(1 - 1 / 3, 1e-12)
  })

  it('wrong-confident (1,0,0) vs outcome 1 → 2', () => {
    expect(brierScore([1, 0, 0], [0, 1, 0])).to.equal(2)
  })

  it('is deterministic with no Date.now() on the scoring path', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../../../lib/forecasts/brier.ts'),
      'utf8'
    )
    expect(src).to.not.match(/Date\.now\s*\(/)
  })

  it('length mismatch is explicit', () => {
    expect(() => brierScore([0, 0, 0, 0, 0, 1], [1, 0, 0, 0])).to.throw('brier-length-mismatch')
  })

  it('skill is null on a refund resolution', () => {
    const refund = [1 / 3, 1 / 3, 1 / 3]
    expect(uniformBaselineBrier(refund)).to.equal(0)
    expect(brierSkillScore(0, refund)).to.equal(null)
    expect(Number.isFinite(brierSkillScore(0, refund) as any) || brierSkillScore(0, refund) === null)
      .to.equal(true)
  })

  it('crowdAggregate of [1,0] and [0,1] is [0.5, 0.5] and can exclude the caller', () => {
    const all = crowdAggregate([
      { userId: 'a', vector: [1, 0] },
      { userId: 'b', vector: [0, 1] },
    ])
    expect(all.count).to.equal(2)
    expect(all.vector).to.deep.equal([0.5, 0.5])
    const withoutA = crowdAggregate(
      [
        { userId: 'a', vector: [1, 0] },
        { userId: 'b', vector: [0, 1] },
      ],
      'a'
    )
    expect(withoutA.count).to.equal(1)
    expect(withoutA.vector).to.deep.equal([0, 1])
  })

  it('Redis-writing helper persists [0, 1] units, not 0–100', () => {
    const stored = serializeLatest([1, 0], '2026-01-01T00:00:00.000Z')
    expect(stored.vector).to.deep.equal([1, 0])
    expect(stored.vector).to.not.deep.equal([100, 0])
    const fromHundred = serializeLatest([100, 0], '2026-01-01T00:00:00.000Z')
    expect(fromHundred.vector[0]).to.equal(1)
    expect(fromHundred.vector[1]).to.equal(0)
  })
})
