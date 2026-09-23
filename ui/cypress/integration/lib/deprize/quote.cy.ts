import {
  betBudget,
  betSlice,
  buildAmounts,
  quoteQtyByProbing,
  searchMaxQtyWithinCost,
} from '@/lib/deprize/quote-math'

const ETH = 10n ** 18n

describe('deprize quote math', () => {
  describe('betSlice / betBudget (5% prize slice)', () => {
    it('splits 1 ETH into a 5% slice and 95% budget', () => {
      const v = ETH
      expect(betSlice(v)).to.equal(v / 20n)
      expect(betBudget(v)).to.equal(v - v / 20n)
    })

    it('slice + budget always equals the full bet value', () => {
      for (const v of [1n, 7n, 19n, 20n, 21n, 12345n, ETH, ETH * 3n + 7n]) {
        expect(betSlice(v) + betBudget(v)).to.equal(v)
      }
    })

    it('returns zero for non-positive input', () => {
      expect(betSlice(0n)).to.equal(0n)
      expect(betBudget(0n)).to.equal(0n)
      expect(betSlice(-5n)).to.equal(0n)
      expect(betBudget(-5n)).to.equal(0n)
    })

    it('floors the slice (integer division)', () => {
      // 19 wei / 20 = 0 slice, so the whole amount is budget.
      expect(betSlice(19n)).to.equal(0n)
      expect(betBudget(19n)).to.equal(19n)
    })
  })

  describe('buildAmounts', () => {
    it('places the quantity at the chosen outcome index only', () => {
      expect(buildAmounts(1, 500n, 3)).to.deep.equal([0n, 500n, 0n])
    })

    it('supports selling (negative amounts)', () => {
      expect(buildAmounts(0, -42n, 2)).to.deep.equal([-42n, 0n])
    })
  })

  describe('searchMaxQtyWithinCost', () => {
    it('returns 0 for a non-positive budget', async () => {
      const cost = async (q: bigint) => q
      expect(await searchMaxQtyWithinCost(cost, 0n)).to.equal(0n)
    })

    it('finds the largest qty whose cost fits the budget (cost == qty)', async () => {
      // Identity cost curve: max qty within budget is exactly the budget.
      const cost = async (q: bigint) => q
      expect(await searchMaxQtyWithinCost(cost, 1000n)).to.equal(1000n)
    })

    it('handles a cost curve cheaper than qty (qty grows beyond budget)', async () => {
      // Cost = floor(qty / 2): a budget of 1000 should buy ~2000 tokens.
      const cost = async (q: bigint) => q / 2n
      const qty = await searchMaxQtyWithinCost(cost, 1000n)
      // Largest qty with floor(qty/2) <= 1000 is 2001 (floor(2001/2)=1000).
      expect(qty).to.equal(2001n)
    })

    it('respects a fee-inclusive convex cost curve (never overspends)', async () => {
      // net = qty; fee = 1% of net; cost = net + fee ≈ qty * 1.01.
      const cost = async (q: bigint) => {
        const net = q
        const fee = net / 100n
        return net + fee
      }
      const budget = 1_010_000n
      const qty = await searchMaxQtyWithinCost(cost, budget)
      expect((await cost(qty)) <= budget).to.equal(true)
      expect((await cost(qty + 1n)) > budget).to.equal(true)
    })
  })

  describe('quoteQtyByProbing', () => {
    it('fits a flat fee curve in a couple of probes', async () => {
      let calls = 0
      const cost = async (q: bigint) => {
        calls += 1
        const net = q
        return net + net / 100n
      }
      const budget = ETH
      const qty = await quoteQtyByProbing(cost, budget)
      expect(calls < 8).to.equal(true)
      expect((await cost(qty)) <= budget).to.equal(true)
      expect(qty > budget / 2n).to.equal(true)
    })

    it('grows a sub-0.001 ETH bet when the outcome is cheaper than the budget', async () => {
      // Probe qty equals the whole budget at or under 0.001 ETH. A flat 20%
      // price costs a fifth of that, so the fill must grow to about 5×.
      const budget = 5n * 10n ** 14n
      const cost = async (q: bigint) => q / 5n
      const qty = await quoteQtyByProbing(cost, budget)
      expect((await cost(qty)) <= budget).to.equal(true)
      expect(qty).to.equal(budget * 5n)
    })

    it('fits a convex curve without overspending or dozens of probes', async () => {
      let calls = 0
      const cost = async (q: bigint) => {
        calls += 1
        return q + (q * q) / ETH
      }
      const budget = ETH
      const qty = await quoteQtyByProbing(cost, budget)
      const probes = calls
      const spent = await cost(qty)
      expect(probes < 12).to.equal(true)
      expect(spent <= budget).to.equal(true)
      expect(spent * 100n > budget * 90n).to.equal(true)
    })
  })
})
