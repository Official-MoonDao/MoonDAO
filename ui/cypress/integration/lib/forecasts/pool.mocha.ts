/// <reference types="node" />
/**
 * Acceptance: pooling the market distribution with the DAO distribution.
 *
 * Log-linear (weighted geometric) pooling, because it is the multi-outcome
 * generalization of averaging in log-odds space and mildly extremizes, which
 * is the standard behaviour for aggregating probability forecasts.
 */
const REQUEST = '@/lib/forecasts/pool'
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

describe('deprize consensus pooling', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, [
      'logLinearPool',
      'marketEvidence',
      'daoEvidence',
      'MARKET_EVIDENCE_REF_ETH',
      'DAO_EVIDENCE_REF',
    ])
  })

  it('returns the same distribution when both sources agree', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [0.9, 0.1], weight: 1 },
      { p: [0.9, 0.1], weight: 1 },
    ])
    expect(pooled[0]).to.be.closeTo(0.9, 1e-9)
    expect(pooled[1]).to.be.closeTo(0.1, 1e-9)
  })

  it('always produces a normalized distribution', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [0.5, 0.3, 0.2], weight: 2 },
      { p: [0.1, 0.1, 0.8], weight: 1 },
    ])
    expect(sum(pooled)).to.be.closeTo(1, CLOSE)
    for (const p of pooled) expect(p).to.be.greaterThan(0)
  })

  it('lands in the middle when the two sources are mirror images', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [0.8, 0.2], weight: 1 },
      { p: [0.2, 0.8], weight: 1 },
    ])
    expect(pooled[0]).to.be.closeTo(0.5, 1e-9)
    expect(pooled[1]).to.be.closeTo(0.5, 1e-9)
  })

  it('extremizes slightly relative to a plain average', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [0.6, 0.4], weight: 1 },
      { p: [0.7, 0.3], weight: 1 },
    ])
    expect(pooled[0]).to.be.greaterThan(0.65)
    expect(pooled[0]).to.be.lessThan(0.7)
  })

  it('ignores a series carrying no evidence', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [0.9, 0.1], weight: 1 },
      { p: [0.1, 0.9], weight: 0 },
    ])
    expect(pooled[0]).to.be.closeTo(0.9, 1e-9)
  })

  it('floors probabilities so one zero cannot annihilate an outcome', () => {
    const { logLinearPool } = mod
    const pooled = logLinearPool([
      { p: [1, 0], weight: 1 },
      { p: [0.5, 0.5], weight: 1 },
    ])
    expect(pooled[1]).to.be.greaterThan(0)
    expect(sum(pooled)).to.be.closeTo(1, CLOSE)
  })

  it('returns null when nothing has any evidence behind it', () => {
    const { logLinearPool } = mod
    expect(
      logLinearPool([
        { p: [0.5, 0.5], weight: 0 },
        { p: [0.5, 0.5], weight: 0 },
      ])
    ).to.equal(null)
    expect(logLinearPool([])).to.equal(null)
  })

  it('gives a demo market no evidence at all, however much play money it holds', () => {
    const { marketEvidence } = mod
    expect(marketEvidence(1000, false)).to.equal(0)
    expect(marketEvidence(0, false)).to.equal(0)
  })

  it('scales market evidence with real collateral and clamps at one', () => {
    const { marketEvidence, MARKET_EVIDENCE_REF_ETH } = mod
    expect(MARKET_EVIDENCE_REF_ETH).to.be.greaterThan(0)
    expect(marketEvidence(0, true)).to.equal(0)
    expect(marketEvidence(MARKET_EVIDENCE_REF_ETH / 2, true)).to.be.closeTo(0.5, CLOSE)
    expect(marketEvidence(MARKET_EVIDENCE_REF_ETH, true)).to.be.closeTo(1, CLOSE)
    expect(marketEvidence(MARKET_EVIDENCE_REF_ETH * 100, true)).to.be.closeTo(1, CLOSE)
  })

  it('scales DAO evidence with participating voting power and clamps at one', () => {
    const { daoEvidence, DAO_EVIDENCE_REF } = mod
    expect(DAO_EVIDENCE_REF).to.be.greaterThan(0)
    expect(daoEvidence(0)).to.equal(0)
    expect(daoEvidence(DAO_EVIDENCE_REF / 2)).to.be.closeTo(0.5, CLOSE)
    expect(daoEvidence(DAO_EVIDENCE_REF * 100)).to.be.closeTo(1, CLOSE)
  })
})

export {}
