/// <reference types="node" />
/**
 * Acceptance: how a voter's vMOONEY becomes a weight.
 *
 * Quadratic weighting is only safe if raw balances are summed BEFORE the root
 * is taken, because sqrt(a) + sqrt(b) > sqrt(a + b) would otherwise reward
 * splitting holdings across wallets.
 */
const REQUEST = '@/lib/forecasts/weighting'
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

describe('deprize forecast weighting', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, [
      'FORECAST_MAX_WEIGHT_SHARE',
      'VMOONEY_UNAVAILABLE',
      'votingWeight',
      'votingWeightFromBalances',
      'capWeights',
      'resolveVmooney',
    ])
  })

  it('weights a voter by the square root of their vMOONEY', () => {
    const { votingWeight } = mod
    expect(votingWeight(10000)).to.be.closeTo(100, CLOSE)
    expect(votingWeight(1)).to.be.closeTo(1, CLOSE)
  })

  it('gives no weight to a Citizen holding nothing, rather than throwing', () => {
    const { votingWeight } = mod
    expect(votingWeight(0)).to.equal(0)
    expect(votingWeight(-5)).to.equal(0)
    expect(votingWeight(NaN)).to.equal(0)
    expect(votingWeight(Infinity)).to.equal(0)
  })

  it('sums balances across chains before rooting, so splitting wallets gains nothing', () => {
    const { votingWeight, votingWeightFromBalances } = mod
    const combined = votingWeightFromBalances([2500, 2500])
    expect(combined).to.be.closeTo(votingWeight(5000), CLOSE)
    // The bug this guards: rooting each balance first and adding.
    expect(combined).to.be.lessThan(votingWeight(2500) * 2 - CLOSE)
    expect(votingWeightFromBalances([])).to.equal(0)
  })

  it('caps any single voter so one holder cannot own the number', () => {
    const { capWeights, FORECAST_MAX_WEIGHT_SHARE } = mod
    expect(FORECAST_MAX_WEIGHT_SHARE).to.be.greaterThan(0)
    expect(FORECAST_MAX_WEIGHT_SHARE).to.be.lessThan(1)

    const whale = [1000, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const capped = capWeights(whale, 0.15)
    expect(sum(capped)).to.be.closeTo(1, CLOSE)
    expect(capped[0]).to.be.closeTo(0.15, CLOSE)
    for (let i = 1; i < capped.length; i++) {
      expect(capped[i]).to.be.closeTo(0.85 / 9, CLOSE)
    }
  })

  it('caps every voter over the limit, not just the largest', () => {
    const { capWeights } = mod
    const twoWhales = [1000, 1000, 1, 1, 1, 1, 1, 1, 1, 1]
    const capped = capWeights(twoWhales, 0.15)
    expect(sum(capped)).to.be.closeTo(1, CLOSE)
    expect(capped[0]).to.be.closeTo(0.15, CLOSE)
    expect(capped[1]).to.be.closeTo(0.15, CLOSE)
    for (let i = 2; i < capped.length; i++) {
      expect(capped[i]).to.be.closeTo(0.7 / 8, CLOSE)
    }
  })

  it('leaves an already-compliant distribution alone apart from normalizing', () => {
    const { capWeights } = mod
    const even = capWeights([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 0.15)
    for (const w of even) expect(w).to.be.closeTo(0.1, CLOSE)
  })

  it('falls back to uniform when the cap is arithmetically impossible', () => {
    const { capWeights } = mod
    // Three voters cannot each hold 15 percent or less.
    const capped = capWeights([3, 1, 1], 0.15)
    expect(sum(capped)).to.be.closeTo(1, CLOSE)
    for (const w of capped) expect(w).to.be.closeTo(1 / 3, CLOSE)
  })

  it('handles empty and all-zero weight sets without producing NaN', () => {
    const { capWeights } = mod
    expect(capWeights([], 0.15)).to.deep.equal([])
    const zeros = capWeights([0, 0, 0], 0.15)
    for (const w of zeros) expect(Number.isFinite(w)).to.equal(true)
  })

  it('uses the live balance, and the stored value only when the read failed', () => {
    const { resolveVmooney, VMOONEY_UNAVAILABLE } = mod
    // Fly with Frank signals a failed batch read with a non-finite sentinel.
    expect(Number.isFinite(VMOONEY_UNAVAILABLE)).to.equal(false)

    expect(resolveVmooney(500, 900)).to.equal(500)
    expect(resolveVmooney(VMOONEY_UNAVAILABLE, 900)).to.equal(900)
    expect(resolveVmooney(NaN, 900)).to.equal(900)
    // A live zero is real: they unlocked. It must not silently revive the old value.
    expect(resolveVmooney(0, 900)).to.equal(0)
  })
})

export {}
