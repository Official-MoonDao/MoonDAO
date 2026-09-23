import {
  betBudget,
  betSlice,
  buildAmounts,
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
})
