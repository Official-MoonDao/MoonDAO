import { DePrizeState, shouldSurfaceResolution } from '@/lib/deprize/constants'
import {
  normalizeProbabilities,
  rawCtfResolved,
  resolvedAtMsFromBlockTimestamp,
} from '@/lib/deprize/serverMarket'

describe('serverMarket helpers', () => {
  it('normalizes prices so a market row sums to 100', () => {
    const out = normalizeProbabilities([40, 40, 20])
    expect(out.reduce((a, b) => a + b, 0)).to.be.closeTo(100, 1e-9)
    expect(normalizeProbabilities([50, 50]).every((p) => p === 50)).to.equal(true)
    expect(normalizeProbabilities([NaN, 10, Infinity])).to.deep.equal([0, 100, 0])
    expect(normalizeProbabilities([0, 0, 0])).to.deep.equal([0, 0, 0])
  })

  it('exposes raw resolved and the interpreted shouldSurfaceResolution separately', () => {
    expect(rawCtfResolved(0n)).to.equal(false)
    expect(rawCtfResolved(1n)).to.equal(true)
    expect(
      shouldSurfaceResolution({
        ctfResolved: true,
        registryState: DePrizeState.OPEN,
        marketClosed: false,
      })
    ).to.equal(false)
    expect(
      shouldSurfaceResolution({
        ctfResolved: true,
        registryState: DePrizeState.OPEN,
        marketClosed: true,
      })
    ).to.equal(true)
    expect(
      shouldSurfaceResolution({
        ctfResolved: true,
        registryState: DePrizeState.SETTLED,
        marketClosed: false,
      })
    ).to.equal(true)
  })

  it('never invents a resolution time from the wall clock', () => {
    const before = Date.now()
    expect(resolvedAtMsFromBlockTimestamp(null)).to.equal(null)
    expect(resolvedAtMsFromBlockTimestamp(0)).to.equal(null)
    expect(resolvedAtMsFromBlockTimestamp(1_700_000_000)).to.equal(1_700_000_000_000)
    const after = Date.now()
    const value = resolvedAtMsFromBlockTimestamp(undefined)
    expect(value).to.equal(null)
    expect(after - before).to.be.lessThan(50)
  })
})
