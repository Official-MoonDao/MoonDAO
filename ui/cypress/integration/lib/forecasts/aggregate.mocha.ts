/// <reference types="node" />
/**
 * Acceptance: turning individual allocations into the DAO distribution.
 *
 * DAO_i = sum(weight_u * alloc_u,i) / sum(weight_u). With one-hot allocations
 * this must reduce exactly to the backing-share computation Fly with Frank
 * already does in aggregateDelegations, so one function serves both cases.
 */
const REQUEST = '@/lib/forecasts/aggregate'
const CLOSE = 1e-9

/** Lazy load so an unimplemented module fails this suite, not the whole run. */
function loadModule(request: string): any {
  try {
    return require(request)
  } catch (err: any) {
    throw new Error(
      `[not implemented] Could not load "${request}". Create it as described in the plan. ` +
        `Underlying error: ${err?.message ?? String(err)}`
    )
  }
}

function requireExports(mod: any, request: string, names: string[]): void {
  const missing = names.filter((name) => typeof mod?.[name] === 'undefined')
  if (missing.length > 0) {
    throw new Error(`[not implemented] "${request}" must export: ${missing.join(', ')}`)
  }
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

describe('deprize forecast aggregation', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, ['aggregateForecastVotes', 'filterToCitizens'])
  })

  it('reduces to backing share when nobody splits', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes(
      [
        { voterAddress: '0xa', allocation: [100, 0], weight: 3 },
        { voterAddress: '0xb', allocation: [0, 100], weight: 1 },
      ],
      2
    )
    expect(result.vector[0]).to.be.closeTo(0.75, CLOSE)
    expect(result.vector[1]).to.be.closeTo(0.25, CLOSE)
    expect(result.totalWeight).to.be.closeTo(4, CLOSE)
    expect(sum(result.vector)).to.be.closeTo(1, CLOSE)
  })

  it('weights split allocations by voting power', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes(
      [
        { voterAddress: '0xa', allocation: [60, 40], weight: 3 },
        { voterAddress: '0xb', allocation: [0, 100], weight: 1 },
      ],
      2
    )
    expect(result.vector[0]).to.be.closeTo(0.45, CLOSE)
    expect(result.vector[1]).to.be.closeTo(0.55, CLOSE)
    expect(sum(result.vector)).to.be.closeTo(1, CLOSE)
  })

  it('records a zero-weight Citizen as a participant who moves nothing', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes(
      [
        { voterAddress: '0xa', allocation: [100, 0], weight: 3 },
        { voterAddress: '0xb', allocation: [0, 100], weight: 0 },
      ],
      2
    )
    expect(result.vector[0]).to.be.closeTo(1, CLOSE)
    expect(result.vector[1]).to.be.closeTo(0, CLOSE)
    expect(result.totalWeight).to.be.closeTo(3, CLOSE)
    expect(result.participants).to.equal(2)
  })

  it('counts backers per outcome, including zero-weight ones', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes(
      [
        { voterAddress: '0xa', allocation: [100, 0, 0], weight: 5 },
        { voterAddress: '0xb', allocation: [50, 50, 0], weight: 2 },
        { voterAddress: '0xc', allocation: [0, 0, 100], weight: 0 },
      ],
      3
    )
    expect(result.backersByOutcome).to.deep.equal([2, 1, 1])
    expect(result.participants).to.equal(3)
  })

  it('produces zeros rather than NaN when there is no weight behind anything', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes(
      [{ voterAddress: '0xa', allocation: [100, 0], weight: 0 }],
      2
    )
    expect(result.totalWeight).to.equal(0)
    for (const p of result.vector) expect(Number.isFinite(p)).to.equal(true)
  })

  it('returns an empty distribution of the right shape for an empty book', () => {
    const { aggregateForecastVotes } = mod
    const result = aggregateForecastVotes([], 4)
    expect(result.vector).to.have.length(4)
    expect(result.participants).to.equal(0)
    expect(result.totalWeight).to.equal(0)
  })

  it('drops voters who do not hold a Citizen, case-insensitively', () => {
    const { filterToCitizens } = mod
    const votes = [
      { voterAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', allocation: [100, 0], weight: 1 },
      { voterAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', allocation: [0, 100], weight: 1 },
    ]
    const kept = filterToCitizens(votes, ['0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'])
    expect(kept).to.have.length(1)
    expect(kept[0].voterAddress).to.equal('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(filterToCitizens(votes, [])).to.have.length(0)
  })
})

export {}
