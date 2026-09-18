/// <reference types="node" />
/**
 * Acceptance: the on-chain payload contract for a DePrize prediction.
 *
 * A prediction is a row in Forecasts.sol, keyed by (address, voteId). The
 * payload carries an allocation across outcomes plus the voter's vMOONEY at
 * write time, which is used only as an RPC-failure fallback. voteId is the
 * prize id — Forecasts is a dedicated table, so there is no reserved range.
 */
const REQUEST = '@/lib/deprize/forecastVote'
const CLOSE = 1e-9

/**
 * Loaded lazily: a static import of a module that does not exist yet would
 * throw at require time and abort the whole mocha run, hiding every other
 * suite. This way an unimplemented piece is one readable hook failure.
 */
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

describe('deprize forecast vote encoding', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, [
      'FORECAST_VOTE_SCHEMA_VERSION',
      'deprizeForecastVoteId',
      'encodeForecastVote',
      'decodeForecastVote',
      'parseForecastVotes',
      'allocationVector',
      'isValidAllocation',
    ])
  })

  it('uses the prize id as voteId, since Forecasts is a dedicated table', () => {
    const { deprizeForecastVoteId } = mod
    expect(deprizeForecastVoteId(22)).to.equal(22)
    expect(deprizeForecastVoteId(0)).to.equal(0)
    expect(deprizeForecastVoteId(9)).to.not.equal(deprizeForecastVoteId(10))
  })

  it('round-trips an allocation and the stored vMOONEY', () => {
    const { encodeForecastVote, decodeForecastVote } = mod
    const encoded = encodeForecastVote([60, 0, 40, 0], 1234.5)
    expect(encoded).to.be.a('string')

    const parsed = JSON.parse(encoded)
    expect(parsed.v).to.equal(mod.FORECAST_VOTE_SCHEMA_VERSION)
    expect(parsed.vp).to.be.closeTo(1234.5, CLOSE)

    const decoded = decodeForecastVote(encoded, 4)
    expect(decoded).to.not.equal(null)
    expect(decoded.allocation).to.deep.equal([60, 0, 40, 0])
    expect(decoded.vmooney).to.be.closeTo(1234.5, CLOSE)
  })

  it('accepts an object as well as a JSON string, the way Tableland returns it', () => {
    const { encodeForecastVote, decodeForecastVote } = mod
    const encoded = encodeForecastVote([100, 0], 0)
    expect(decodeForecastVote(JSON.parse(encoded), 2).allocation).to.deep.equal([100, 0])
  })

  it('records a zero-vMOONEY Citizen without losing their allocation', () => {
    const { encodeForecastVote, decodeForecastVote } = mod
    const decoded = decodeForecastVote(encodeForecastVote([25, 75], 0), 2)
    expect(decoded.allocation).to.deep.equal([25, 75])
    expect(decoded.vmooney).to.equal(0)
  })

  it('only accepts integer percents that sum to exactly 100', () => {
    const { isValidAllocation, encodeForecastVote } = mod
    expect(isValidAllocation([100, 0])).to.equal(true)
    expect(isValidAllocation([60, 40])).to.equal(true)
    expect(isValidAllocation([33, 33, 34])).to.equal(true)

    expect(isValidAllocation([60, 30])).to.equal(false) // sums to 90
    expect(isValidAllocation([60, 50])).to.equal(false) // sums to 110
    expect(isValidAllocation([100.5, -0.5])).to.equal(false) // non-integer
    expect(isValidAllocation([120, -20])).to.equal(false) // negative
    expect(isValidAllocation([0, 0])).to.equal(false) // no backing at all
    expect(isValidAllocation([])).to.equal(false)

    expect(() => encodeForecastVote([60, 30], 1)).to.throw()
  })

  it('refuses an unknown schema version rather than guessing', () => {
    const { decodeForecastVote } = mod
    expect(decodeForecastVote(JSON.stringify({ v: 2, a: { '0': 100 }, vp: 1 }), 2)).to.equal(null)
    expect(decodeForecastVote(JSON.stringify({ a: { '0': 100 }, vp: 1 }), 2)).to.equal(null)
  })

  it('returns null for malformed payloads instead of throwing', () => {
    const { decodeForecastVote } = mod
    expect(decodeForecastVote('not json', 2)).to.equal(null)
    expect(decodeForecastVote(JSON.stringify({ v: 1, vp: 1 }), 2)).to.equal(null)
    expect(decodeForecastVote(null, 2)).to.equal(null)
    expect(decodeForecastVote(JSON.stringify({ v: 1, a: {}, vp: 1 }), 2)).to.equal(null)
  })

  it('drops a row whose allocation references an outcome the roster no longer has', () => {
    const { decodeForecastVote } = mod
    const stale = JSON.stringify({ v: 1, a: { '0': 50, '9': 50 }, vp: 10 })
    expect(decodeForecastVote(stale, 4)).to.equal(null)
  })

  it('parses Forecasts rows, lowercasing addresses and skipping bad rows', () => {
    const { encodeForecastVote, parseForecastVotes } = mod
    const rows = [
      {
        address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        vote: encodeForecastVote([100, 0], 400),
        timestamp: 1_700_000_000,
      },
      {
        address: '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb',
        vote: encodeForecastVote([25, 75], 900),
        timestamp: '1700000001',
      },
      { address: '0xcccccccccccccccccccccccccccccccccccccccc', vote: '{{ not json' },
      { address: '0xdddddddddddddddddddddddddddddddddddddddd', vote: JSON.stringify({ v: 9 }) },
      { vote: encodeForecastVote([100, 0], 1) },
    ]

    const parsed = parseForecastVotes(rows, 2)
    expect(parsed).to.have.length(2)
    expect(parsed[0].voterAddress).to.equal('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(parsed[0].allocation).to.deep.equal([100, 0])
    expect(parsed[0].storedVmooney).to.be.closeTo(400, CLOSE)
    expect(parsed[0].timestamp).to.equal(1_700_000_000)
    expect(parsed[1].voterAddress).to.equal('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(parsed[1].allocation).to.deep.equal([25, 75])
    expect(parsed[1].timestamp).to.equal(1_700_000_001)
  })

  it('normalizes an allocation into a probability vector', () => {
    const { allocationVector } = mod
    expect(allocationVector([100, 0, 0])).to.deep.equal([1, 0, 0])

    const split = allocationVector([60, 40])
    expect(split[0]).to.be.closeTo(0.6, CLOSE)
    expect(split[1]).to.be.closeTo(0.4, CLOSE)

    const thirds = allocationVector([33, 33, 34])
    expect(thirds.reduce((a: number, b: number) => a + b, 0)).to.be.closeTo(1, CLOSE)
  })
})

export {}
