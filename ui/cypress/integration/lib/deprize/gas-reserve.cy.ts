import {
  DEFAULT_GAS_RESERVE_WEI,
  gasReserveEth,
  gasReserveWei,
  spendableFromBalanceEth,
} from '@/lib/deprize/gas-reserve'

const ARBITRUM = 42161
const ARBITRUM_SEPOLIA = 421614
const SEPOLIA = 11155111

// The reported wallet: real ETH on Arbitrum, reported by the UI as 0 available.
const REPORTED_BALANCE_ETH = 0.000585671479579739

// Measured on Arbitrum: 1,318,730 gas at 0.02 gwei.
const MEASURED_BET_COST_ETH = 0.0000263746

describe('deprize gas reserve', () => {
  describe('gasReserveWei', () => {
    it('uses the cheap L2 reserve on Arbitrum', () => {
      expect(Number(gasReserveWei(ARBITRUM))).to.be.lessThan(Number(DEFAULT_GAS_RESERVE_WEI))
      expect(gasReserveWei(ARBITRUM_SEPOLIA)).to.equal(gasReserveWei(ARBITRUM))
    })

    it('keeps the conservative default on L1-style and unknown chains', () => {
      expect(gasReserveWei(SEPOLIA)).to.equal(DEFAULT_GAS_RESERVE_WEI)
      expect(gasReserveWei(999999)).to.equal(DEFAULT_GAS_RESERVE_WEI)
      expect(gasReserveWei(undefined)).to.equal(DEFAULT_GAS_RESERVE_WEI)
    })

    it('still covers a real bet with room for a gas spike', () => {
      expect(gasReserveEth(ARBITRUM)).to.be.greaterThan(MEASURED_BET_COST_ETH * 5)
    })
  })

  describe('spendableFromBalanceEth', () => {
    it('no longer reports the reported wallet as having nothing to bet', () => {
      const spendable = spendableFromBalanceEth(REPORTED_BALANCE_ETH, ARBITRUM)
      expect(spendable).to.be.greaterThan(0)
      // The 0.0003 ETH bet that was being blocked now fits.
      expect(spendable).to.be.greaterThan(0.0003)
    })

    it('leaves the full reserve behind', () => {
      const spendable = spendableFromBalanceEth(REPORTED_BALANCE_ETH, ARBITRUM)
      expect(REPORTED_BALANCE_ETH - spendable).to.be.closeTo(gasReserveEth(ARBITRUM), 1e-18)
    })

    it('floors at zero when the balance cannot cover gas', () => {
      expect(spendableFromBalanceEth(0.00001, ARBITRUM)).to.equal(0)
      expect(spendableFromBalanceEth(0, ARBITRUM)).to.equal(0)
    })

    it('treats a missing balance as zero rather than negative', () => {
      expect(spendableFromBalanceEth(undefined, ARBITRUM)).to.equal(0)
      expect(spendableFromBalanceEth(null, ARBITRUM)).to.equal(0)
    })

    it('would have blocked the reported wallet under the old flat reserve', () => {
      // Regression witness: the same balance against the L1-sized default.
      expect(spendableFromBalanceEth(REPORTED_BALANCE_ETH, SEPOLIA)).to.equal(0)
    })
  })
})
