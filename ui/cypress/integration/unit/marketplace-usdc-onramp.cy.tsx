import { USDC_ADDRESSES } from '../../../const/config'
import {
  computePurchasePrice,
  evaluateUsdcPurchase,
  NON_CITIZEN_MARKUP,
  parseListingPrice,
  parseUsdcBalance,
} from '../../../lib/marketplace/usdcListingPurchase'
import {
  destinationAssetFor,
  estimateOnrampFiatUsd,
  formatOnrampPurchaseAmount,
  isOnrampAsset,
  onrampAssetIcon,
  USDC_BY_CHAIN_ID,
} from '../../../lib/onramp/assets'

describe('Marketplace USDC onramp', () => {
  describe('onramp asset helpers', () => {
    it('isOnrampAsset accepts only ETH and USDC', () => {
      expect(isOnrampAsset('ETH')).to.equal(true)
      expect(isOnrampAsset('USDC')).to.equal(true)
      expect(isOnrampAsset('DAI')).to.equal(false)
      expect(isOnrampAsset('usdc')).to.equal(false)
      expect(isOnrampAsset(undefined)).to.equal(false)
      expect(isOnrampAsset(null)).to.equal(false)
    })

    it('onrampAssetIcon maps to the right coin icon', () => {
      expect(onrampAssetIcon('ETH')).to.equal('/coins/ETH.svg')
      expect(onrampAssetIcon('USDC')).to.equal('/coins/USDC.svg')
    })

    it('formatOnrampPurchaseAmount uses 6 decimals for USDC, 8 for ETH', () => {
      expect(formatOnrampPurchaseAmount(12.3456789, 'USDC')).to.equal(
        '12.345679'
      )
      expect(formatOnrampPurchaseAmount(0.123456789, 'ETH')).to.equal(
        '0.12345679'
      )
      // Coinbase Order API expects a plain decimal string, never exponent form.
      expect(formatOnrampPurchaseAmount(1e-7, 'ETH')).to.equal('0.00000010')
    })

    it('estimateOnrampFiatUsd treats USDC as ~$1 with a 5% buffer', () => {
      expect(estimateOnrampFiatUsd(100, 'USDC')).to.equal(105)
      expect(estimateOnrampFiatUsd(1, 'USDC')).to.equal(2) // ceil(1.05)
    })

    it('estimateOnrampFiatUsd converts ETH via spot price with buffer', () => {
      expect(estimateOnrampFiatUsd(0.5, 'ETH', 2000)).to.equal(1050)
    })

    it('estimateOnrampFiatUsd is undefined without an ETH spot price or valid amount', () => {
      expect(estimateOnrampFiatUsd(0.5, 'ETH')).to.equal(undefined)
      expect(estimateOnrampFiatUsd(0, 'USDC')).to.equal(undefined)
      expect(estimateOnrampFiatUsd(-3, 'USDC')).to.equal(undefined)
    })
  })

  describe('destinationAssetFor (Privy/MoonPay)', () => {
    it("returns the 'eth' shorthand for native ETH on any chain", () => {
      expect(destinationAssetFor(1, 'ETH')).to.equal('eth')
      expect(destinationAssetFor(42161, 'ETH')).to.equal('eth')
    })

    it('returns the native USDC contract for configured chains', () => {
      expect(destinationAssetFor(42161, 'USDC')).to.equal(
        USDC_ADDRESSES.arbitrum
      )
      expect(destinationAssetFor(1, 'USDC')).to.equal(USDC_ADDRESSES.ethereum)
      expect(destinationAssetFor(8453, 'USDC')).to.equal(USDC_ADDRESSES.base)
    })

    it('USDC chain map matches const/config addresses', () => {
      expect(USDC_BY_CHAIN_ID[42161]).to.equal(USDC_ADDRESSES.arbitrum)
      expect(USDC_BY_CHAIN_ID[11155111]).to.equal(USDC_ADDRESSES.sepolia)
      expect(USDC_BY_CHAIN_ID[84532]).to.equal(
        USDC_ADDRESSES['base-sepolia-testnet']
      )
    })

    it('throws for chains without a configured USDC contract', () => {
      expect(() => destinationAssetFor(137, 'USDC')).to.throw(
        'USDC is not configured for chain 137'
      )
    })
  })

  describe('parseListingPrice', () => {
    it('parses plain and comma-separated prices', () => {
      expect(parseListingPrice('100')).to.equal(100)
      expect(parseListingPrice('1,250.50')).to.equal(1250.5)
      expect(parseListingPrice(42)).to.equal(42)
    })
  })

  describe('computePurchasePrice', () => {
    it('citizens pay the flat listing price', () => {
      expect(
        computePurchasePrice({ price: '100', isGift: false, isCitizen: true })
      ).to.equal(100)
    })

    it('gift listings are always flat-priced', () => {
      expect(
        computePurchasePrice({ price: '100', isGift: true, isCitizen: false })
      ).to.equal(100)
    })

    it('non-citizens pay a 10% markup', () => {
      expect(
        computePurchasePrice({ price: '100', isGift: false, isCitizen: false })
      ).to.equal(100 * NON_CITIZEN_MARKUP)
    })
  })

  describe('parseUsdcBalance', () => {
    it('parses a resolved balance', () => {
      expect(parseUsdcBalance('12.5')).to.equal(12.5)
      expect(parseUsdcBalance('0')).to.equal(0)
    })

    it('returns null when unresolved or invalid', () => {
      expect(parseUsdcBalance(undefined)).to.equal(null)
      expect(parseUsdcBalance(null)).to.equal(null)
      expect(parseUsdcBalance('')).to.equal(null)
      expect(parseUsdcBalance('NaN')).to.equal(null)
    })
  })

  describe('evaluateUsdcPurchase', () => {
    it('non-USDC listings always pass with no deficit', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: false,
        usdcBalance: null,
        purchasePrice: 100,
      })
      expect(gate.hasEnoughUsdc).to.equal(true)
      expect(gate.usdcDeficit).to.equal(0)
    })

    it('unresolved balance is treated as insufficient for the full price', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: null,
        purchasePrice: 110,
      })
      expect(gate.hasEnoughUsdc).to.equal(false)
      expect(gate.usdcDeficit).to.equal(110)
    })

    it('sufficient balance passes with zero deficit', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: 150,
        purchasePrice: 110,
      })
      expect(gate.hasEnoughUsdc).to.equal(true)
      expect(gate.usdcDeficit).to.equal(0)
    })

    it('exact balance passes', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: 110,
        purchasePrice: 110,
      })
      expect(gate.hasEnoughUsdc).to.equal(true)
      expect(gate.usdcDeficit).to.equal(0)
    })

    it('partial balance reports the exact deficit', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: 40,
        purchasePrice: 110,
      })
      expect(gate.hasEnoughUsdc).to.equal(false)
      expect(gate.usdcDeficit).to.equal(70)
    })

    it('zero balance owes the full purchase price', () => {
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: 0,
        purchasePrice: 110,
      })
      expect(gate.hasEnoughUsdc).to.equal(false)
      expect(gate.usdcDeficit).to.equal(110)
    })

    it('non-citizen markup flows through to the deficit', () => {
      const purchasePrice = computePurchasePrice({
        price: '100',
        isGift: false,
        isCitizen: false,
      })
      const gate = evaluateUsdcPurchase({
        isUsdcListing: true,
        usdcBalance: 100,
        purchasePrice,
      })
      // Non-citizen owes $110 total; $100 in wallet leaves ~$10 to onramp.
      expect(gate.hasEnoughUsdc).to.equal(false)
      expect(gate.usdcDeficit).to.be.closeTo(10, 1e-9)
    })
  })
})
