import { formatUsd, fmtEthWithUsd, fmtUsdFromEth } from '@/lib/deprize/format'

const ETH_PRICE = 3000

describe('deprize USD denomination', () => {
  describe('formatUsd', () => {
    it('matches the launchpad style for typical amounts', () => {
      expect(formatUsd(36)).to.equal('$36.00')
      expect(formatUsd(1.234)).to.equal('$1.23')
      expect(formatUsd(0.045)).to.equal('$0.045')
      expect(formatUsd(150_000)).to.equal('$150,000')
    })

    it('signs PnL when asked', () => {
      expect(formatUsd(3, { signed: true })).to.equal('+$3.00')
      expect(formatUsd(-1.2, { signed: true })).to.equal('-$1.20')
      expect(formatUsd(0, { signed: true })).to.equal('$0.00')
    })
  })

  describe('fmtUsdFromEth', () => {
    it('converts ETH at the live quote', () => {
      expect(fmtUsdFromEth(0.01, ETH_PRICE)).to.equal('$30.00')
      expect(fmtUsdFromEth(0.0003, ETH_PRICE)).to.equal('$0.90')
    })

    it('omits USD when the price or amount is unusable', () => {
      expect(fmtUsdFromEth(0.01, undefined)).to.equal(undefined)
      expect(fmtUsdFromEth(0.01, 0)).to.equal(undefined)
      expect(fmtUsdFromEth(undefined, ETH_PRICE)).to.equal(undefined)
      expect(fmtUsdFromEth(Number.NaN, ETH_PRICE)).to.equal(undefined)
    })
  })

  describe('fmtEthWithUsd', () => {
    it('keeps ETH as the primary figure and tucks USD beside it', () => {
      expect(fmtEthWithUsd(0.01, ETH_PRICE)).to.equal('0.01 ETH (~$30.00)')
      expect(fmtEthWithUsd(0.0006, ETH_PRICE, { approx: true })).to.equal(
        '≈ 0.0006 ETH (~$1.80)'
      )
    })

    it('falls back to ETH-only when the quote is missing', () => {
      expect(fmtEthWithUsd(0.01, null)).to.equal('0.01 ETH')
    })

    it('formats the 5% prize slice instead of rounding it to 0 ETH', () => {
      // 5% of the 0.0003 ETH bet that previously displayed as "0 ETH".
      expect(fmtEthWithUsd(0.000015, ETH_PRICE, { prize: true })).to.equal(
        '0.000015 ETH (~$0.045)'
      )
    })

    it('labels WETH fees the same way as ETH', () => {
      expect(fmtEthWithUsd(0.004, ETH_PRICE, { decimals: 4, unit: 'WETH' })).to.equal(
        '0.004 WETH (~$12.00)'
      )
    })
  })
})
