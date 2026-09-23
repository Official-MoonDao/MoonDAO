import {
  lmsrMarginalPrices,
  maxProbDelta,
  rebuildOddsHistory,
} from '@/lib/deprize/lmsr-history'

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('deprize LMSR history reconstruction', () => {
  describe('lmsrMarginalPrices', () => {
    it('is uniform with no trades', () => {
      expect(lmsrMarginalPrices([0, 0, 0], 0.03)).to.deep.equal([100 / 3, 100 / 3, 100 / 3])
    })

    it('raises the bought outcome, lowers the rest, still sums to 100', () => {
      const p = lmsrMarginalPrices([0.01, 0, 0], 0.03)
      expect(p[0]).to.be.greaterThan(100 / 3)
      expect(p[1]).to.be.lessThan(100 / 3)
      expect(p[1]).to.be.closeTo(p[2], 1e-12)
      expect(sum(p)).to.be.closeTo(100, 1e-9)
    })

    it('matches the closed form exp(q/b)/Σexp(q/b)', () => {
      const q = [0.004, -0.001, 0.002]
      const funding = 0.03
      const b = funding / Math.log(3)
      const e = q.map((x) => Math.exp(x / b))
      const expected = e.map((x) => (100 * x) / sum(e))
      const got = lmsrMarginalPrices(q, funding)
      for (let i = 0; i < 3; i++) expect(got[i]).to.be.closeTo(expected[i], 1e-9)
    })

    it('does not overflow on large positions', () => {
      const p = lmsrMarginalPrices([50, 0, 0], 0.03)
      expect(p[0]).to.be.closeTo(100, 1e-9)
      expect(Number.isFinite(p[1])).to.equal(true)
    })
  })

  describe('rebuildOddsHistory', () => {
    const open = Date.UTC(2026, 8, 1)

    it('starts at the uniform prior on market open and steps after each trade', () => {
      const { history, markers } = rebuildOddsHistory({
        marketStartMs: open,
        initialFundingEth: 0.06,
        numOutcomes: 6,
        trades: [
          { timestampMs: open + 1000, amounts: [0.004, 0, 0, 0, 0, 0] },
          { timestampMs: open + 2000, amounts: [-0.002, 0, 0, 0, 0, 0] },
        ],
      })
      expect(history).to.have.length(3)
      expect(history[0].t).to.equal(open)
      for (const p of history[0].p) expect(p).to.be.closeTo(100 / 6, 1e-9)
      expect(history[1].p[0]).to.be.greaterThan(history[0].p[0])
      expect(history[2].p[0]).to.be.lessThan(history[1].p[0])
      expect(history[2].p[0]).to.be.greaterThan(history[0].p[0])
      expect(markers).to.deep.equal([
        { t: open + 1000, index: 0, buy: true },
        { t: open + 2000, index: 0, buy: false },
      ])
    })

    it('applies funding changes in time order', () => {
      const trade = { timestampMs: open + 5000, amounts: [0.01, 0, 0] }
      const before = rebuildOddsHistory({
        marketStartMs: open,
        initialFundingEth: 0.03,
        numOutcomes: 3,
        trades: [trade],
      })
      const after = rebuildOddsHistory({
        marketStartMs: open,
        initialFundingEth: 0.03,
        numOutcomes: 3,
        trades: [trade],
        fundingChanges: [{ timestampMs: open + 1000, deltaEth: 0.03 }],
      })
      // More liquidity → the same trade moves the price less.
      expect(after.history.at(-1)!.p[0]).to.be.lessThan(before.history.at(-1)!.p[0])
    })

    it('never emits a sample before market open', () => {
      const { history } = rebuildOddsHistory({
        marketStartMs: open,
        initialFundingEth: 0.03,
        numOutcomes: 3,
        trades: [{ timestampMs: open - 10, amounts: [0.001, 0, 0] }],
      })
      expect(history[1].t).to.equal(open)
    })
  })

  describe('maxProbDelta', () => {
    it('reports the largest per-outcome gap and Infinity on NaN', () => {
      expect(maxProbDelta([10, 20, 70], [10.4, 19.6, 70])).to.be.closeTo(0.4, 1e-12)
      expect(maxProbDelta([10, NaN], [10, 20])).to.equal(Infinity)
    })
  })
})
