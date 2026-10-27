import { shouldSweepSellFee } from '@/lib/deprize/feeSweep'

const ROUTER = '0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1'
const SAFE = '0xdFc31084ad3887076913e5d0759a27C65A3C5291'

describe('deprize post-sell fee sweep', () => {
  it('sweeps only when the fee router owns the market', () => {
    expect(shouldSweepSellFee(ROUTER, ROUTER)).to.equal(true)
    expect(shouldSweepSellFee(ROUTER.toLowerCase(), ROUTER)).to.equal(true)
  })

  it('skips a v2 market owned by the Safe', () => {
    expect(shouldSweepSellFee(SAFE, ROUTER)).to.equal(false)
  })

  it('skips when either address is missing', () => {
    expect(shouldSweepSellFee(undefined, ROUTER)).to.equal(false)
    expect(shouldSweepSellFee(SAFE, '')).to.equal(false)
    expect(shouldSweepSellFee('', '')).to.equal(false)
  })
})
