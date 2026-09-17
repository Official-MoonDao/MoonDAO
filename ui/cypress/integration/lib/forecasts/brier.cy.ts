import {
  brierScore,
  brierSkillScore,
  crowdAggregate,
  timeAveragedBrier,
  uniformBaselineBrier,
} from '@/lib/forecasts/brier'
import { serializeLatest } from '@/lib/forecasts/weights'

describe('brier math', () => {
  it('perfect forecast vs one-hot → Brier 0', () => {
    expect(brierScore([1, 0, 0], [1, 0, 0])).to.equal(0)
  })

  it('uniform on 3 outcomes vs one-hot is 2/3 (unnormalized Σ; do not fix to 1/N-averaged)', () => {
    const score = brierScore([1 / 3, 1 / 3, 1 / 3], [1, 0, 0])
    expect(score).to.be.closeTo(2 / 3, 1e-12)
    expect(uniformBaselineBrier([1, 0, 0])).to.be.closeTo(1 - 1 / 3, 1e-12)
  })

  it('wrong-confident (1,0,0) vs outcome 1 → 2', () => {
    expect(brierScore([1, 0, 0], [0, 1, 0])).to.equal(2)
  })

  it('frozen time-average: D0 12:00Z, D1 15:00Z, resolvedAt D3 08:00Z scores D0, D1, D2', () => {
    const v0 = [0.6, 0.4]
    const v1 = [0.2, 0.8]
    const outcome = [1, 0]
    const result = timeAveragedBrier(
      [
        { at: '2026-01-01T12:00:00.000Z', vector: v0 },
        { at: '2026-01-02T15:00:00.000Z', vector: v1 },
      ],
      '2026-01-04T08:00:00.000Z',
      outcome
    )
    expect(result).to.not.equal(null)
    const d0 = brierScore(v0, outcome)
    const d1 = brierScore(v1, outcome)
    const d2 = brierScore(v1, outcome)
    expect(result!.daysScored).to.equal(3)
    expect(result!.calls).to.equal(2)
    expect(result!.brier).to.equal((d0 + d1 + d2) / 3)
  })

  it('post-resolution forecasts do not score', () => {
    const history = [
      { at: '2026-01-01T12:00:00.000Z', vector: [1, 0] },
      { at: '2026-01-04T09:00:00.000Z', vector: [0, 1] },
    ]
    const resolvedAt = '2026-01-04T08:00:00.000Z'
    const outcome = [1, 0]
    const withLate = timeAveragedBrier(history, resolvedAt, outcome)
    const withoutLate = timeAveragedBrier(history.slice(0, 1), resolvedAt, outcome)
    expect(withLate).to.deep.equal(withoutLate)
  })

  it('is deterministic with no Date.now() on the scoring path', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../../../lib/forecasts/brier.ts'),
      'utf8'
    )
    expect(src).to.not.match(/Date\.now\s*\(/)
    const a = timeAveragedBrier(
      [{ at: '2026-01-01T12:00:00.000Z', vector: [1, 0] }],
      '2026-01-03T08:00:00.000Z',
      [1, 0]
    )
    const b = timeAveragedBrier(
      [{ at: '2026-01-01T12:00:00.000Z', vector: [1, 0] }],
      '2026-01-03T08:00:00.000Z',
      [1, 0]
    )
    expect(a).to.deep.equal(b)
  })

  it('day-boundary: D1 00:00Z is D1 not D0; D0 23:59:59.999Z is D0; resolution-day-only is null', () => {
    const outcome = [1, 0]
    const fromMidnight = timeAveragedBrier(
      [
        { at: '2026-01-01T12:00:00.000Z', vector: [1, 0] },
        { at: '2026-01-02T00:00:00.000Z', vector: [0, 1] },
      ],
      '2026-01-04T08:00:00.000Z',
      outcome
    )
    expect(fromMidnight!.daysScored).to.equal(3)
    expect(fromMidnight!.brier).to.equal(
      (brierScore([1, 0], outcome) + brierScore([0, 1], outcome) + brierScore([0, 1], outcome)) / 3
    )

    const lateD0 = timeAveragedBrier(
      [{ at: '2026-01-01T23:59:59.999Z', vector: [1, 0] }],
      '2026-01-03T08:00:00.000Z',
      outcome
    )
    expect(lateD0!.daysScored).to.equal(2)
    expect(lateD0!.brier).to.equal(0)

    expect(
      timeAveragedBrier(
        [{ at: '2026-01-03T01:00:00.000Z', vector: [1, 0] }],
        '2026-01-03T08:00:00.000Z',
        outcome
      )
    ).to.equal(null)
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
