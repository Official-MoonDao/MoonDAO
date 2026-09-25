/// <reference types="node" />
/**
 * Acceptance: an option's citizen-prediction backing is voting power, not a share.
 *
 * A single pick puts 100% of that citizen's weight on one option. The figure
 * is the sum of weight * (allocation / 100). It is not divided by total weight.
 */
const REQUEST = '@/lib/forecasts/aggregate'
const CLOSE = 1e-9

function loadModule(request: string): any {
  try {
    return require(request)
  } catch (err: any) {
    throw new Error(
      `[not implemented] Could not load "${request}". Underlying error: ${
        err?.message ?? String(err)
      }`
    )
  }
}

describe('voting power by outcome', () => {
  let votingPowerByOutcome: (
    votes: readonly { allocation: readonly number[]; weight: number }[],
    nOutcomes: number
  ) => number[]
  let aggregateForecastVotes: (
    votes: readonly { voterAddress: string; allocation: number[]; weight: number }[],
    nOutcomes: number
  ) => { vector: number[]; totalWeight: number }

  before(() => {
    const mod = loadModule(REQUEST)
    if (typeof mod.votingPowerByOutcome !== 'function') {
      throw new Error(`[not implemented] "${REQUEST}" must export votingPowerByOutcome`)
    }
    votingPowerByOutcome = mod.votingPowerByOutcome
    aggregateForecastVotes = mod.aggregateForecastVotes
  })

  it('puts a single pick entirely on one option', () => {
    const power = votingPowerByOutcome([{ allocation: [100, 0, 0], weight: 42 }], 3)
    expect(power[0]).to.be.closeTo(42, CLOSE)
    expect(power[1]).to.equal(0)
    expect(power[2]).to.equal(0)
  })

  it('sums voting power from every citizen who predicted an option', () => {
    const power = votingPowerByOutcome(
      [
        { allocation: [100, 0], weight: 40 },
        { allocation: [100, 0], weight: 60 },
        { allocation: [0, 100], weight: 15 },
      ],
      2
    )
    expect(power[0]).to.be.closeTo(100, CLOSE)
    expect(power[1]).to.be.closeTo(15, CLOSE)
  })

  it('splits one citizen across options by their allocation percents', () => {
    const power = votingPowerByOutcome([{ allocation: [60, 40], weight: 10 }], 2)
    expect(power[0]).to.be.closeTo(6, CLOSE)
    expect(power[1]).to.be.closeTo(4, CLOSE)
  })

  it('does not divide by total weight', () => {
    const votes = [
      { voterAddress: '0xa', allocation: [60, 40, 0], weight: 10 },
      { voterAddress: '0xb', allocation: [0, 100, 0], weight: 5 },
      { voterAddress: '0xc', allocation: [0, 0, 100], weight: 0 },
    ]
    const power = votingPowerByOutcome(votes, 3)
    const aggregate = aggregateForecastVotes(votes, 3)
    expect(power[0]).to.be.closeTo(6, CLOSE)
    expect(power[1]).to.be.closeTo(9, CLOSE)
    expect(power[2]).to.equal(0)
    expect(power[0]).to.not.be.closeTo(aggregate.vector[0], CLOSE)
    for (let i = 0; i < power.length; i++) {
      expect(power[i] / aggregate.totalWeight).to.be.closeTo(aggregate.vector[i], CLOSE)
    }
  })

  it('counts a zero-weight pick as zero backing', () => {
    const power = votingPowerByOutcome([{ allocation: [100, 0], weight: 0 }], 2)
    expect(power).to.deep.equal([0, 0])
  })

  it('ignores a non-finite weight or allocation', () => {
    const power = votingPowerByOutcome(
      [
        { allocation: [100, 0], weight: Number.NaN },
        { allocation: [Number.POSITIVE_INFINITY, 0], weight: 8 },
      ],
      2
    )
    expect(power).to.deep.equal([0, 0])
  })

  it('treats a missing allocation entry as zero', () => {
    const power = votingPowerByOutcome([{ allocation: [100], weight: 8 }], 3)
    expect(power[0]).to.be.closeTo(8, CLOSE)
    expect(power[1]).to.equal(0)
    expect(power[2]).to.equal(0)
  })

  it('returns zeros for an empty book and nothing for a bad outcome count', () => {
    expect(votingPowerByOutcome([], 4)).to.deep.equal([0, 0, 0, 0])
    expect(votingPowerByOutcome([{ allocation: [100], weight: 5 }], 0)).to.deep.equal([])
  })
})

export {}
