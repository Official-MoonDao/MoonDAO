import {
  ARBITRUM_CAIP2,
  ARBITRUM_CHAIN_ID,
  baseUnitsToHumanAmount,
  DEFAULT_SLIPPAGE_BPS,
  getDefaultSwapTokens,
  getSwapToken,
  humanAmountToBaseUnits,
  isSupportedSwapChainId,
  isSwapTokenKey,
  isValidSlippageBps,
  validateSwapPair,
} from '@/lib/privy/swapTokens'

describe('swapTokens allowlist', () => {
  it('exposes Arbitrum constants', () => {
    expect(ARBITRUM_CHAIN_ID).to.equal(42161)
    expect(ARBITRUM_CAIP2).to.equal('eip155:42161')
  })

  it('recognizes only allowlisted token keys', () => {
    expect(isSwapTokenKey('ETH')).to.equal(true)
    expect(isSwapTokenKey('USDC')).to.equal(true)
    expect(isSwapTokenKey('MOONEY')).to.equal(true)
    expect(isSwapTokenKey('DAI')).to.equal(false)
    expect(isSwapTokenKey('0xdeadbeef')).to.equal(false)
    expect(isSwapTokenKey('')).to.equal(false)
    expect(isSwapTokenKey(undefined)).to.equal(false)
  })

  it('getSwapToken returns config for allowed keys', () => {
    const usdc = getSwapToken('USDC')
    expect(usdc.symbol).to.equal('USDC')
    expect(usdc.decimals).to.equal(6)
    expect(usdc.assetAddress).to.match(/^0x[a-fA-F0-9]{40}$/)

    const eth = getSwapToken('ETH')
    expect(eth.assetAddress).to.equal('native')
    expect(eth.decimals).to.equal(18)
  })

  it('getSwapToken rejects arbitrary / forged token addresses', () => {
    expect(() => getSwapToken('0x1234567890123456789012345678901234567890')).to.throw()
    expect(() => getSwapToken('NOTATOKEN')).to.throw()
    expect(() => getSwapToken(undefined)).to.throw()
  })

  it('default token picker excludes hidden/experimental tokens (MOONEY)', () => {
    const keys = getDefaultSwapTokens().map((t) => t.key)
    expect(keys).to.include('ETH')
    expect(keys).to.include('USDC')
    expect(keys).to.not.include('MOONEY')
  })
})

describe('isSupportedSwapChainId', () => {
  it('accepts only Arbitrum', () => {
    expect(isSupportedSwapChainId(42161)).to.equal(true)
    expect(isSupportedSwapChainId('42161')).to.equal(true)
    expect(isSupportedSwapChainId(1)).to.equal(false)
    expect(isSupportedSwapChainId(8453)).to.equal(false)
    expect(isSupportedSwapChainId(137)).to.equal(false)
    expect(isSupportedSwapChainId(undefined)).to.equal(false)
    expect(isSupportedSwapChainId(null)).to.equal(false)
  })
})

describe('validateSwapPair', () => {
  it('accepts two different allowlisted tokens', () => {
    const { from, to } = validateSwapPair('ETH', 'USDC')
    expect(from.key).to.equal('ETH')
    expect(to.key).to.equal('USDC')
  })

  it('rejects identical input/output tokens', () => {
    expect(() => validateSwapPair('ETH', 'ETH')).to.throw('different')
  })

  it('rejects unsupported tokens in a pair', () => {
    expect(() => validateSwapPair('ETH', 'DAI')).to.throw()
    expect(() => validateSwapPair('FOO', 'USDC')).to.throw()
  })
})

describe('isValidSlippageBps', () => {
  it('accepts integers within 0..10000', () => {
    expect(isValidSlippageBps(0)).to.equal(true)
    expect(isValidSlippageBps(DEFAULT_SLIPPAGE_BPS)).to.equal(true)
    expect(isValidSlippageBps(10000)).to.equal(true)
  })

  it('rejects out-of-range or non-integer values', () => {
    expect(isValidSlippageBps(-1)).to.equal(false)
    expect(isValidSlippageBps(10001)).to.equal(false)
    expect(isValidSlippageBps(12.5)).to.equal(false)
    expect(isValidSlippageBps('50' as unknown)).to.equal(false)
  })
})

describe('humanAmountToBaseUnits', () => {
  it('converts whole and fractional ETH (18 decimals)', () => {
    expect(humanAmountToBaseUnits('1', 18).toString()).to.equal('1000000000000000000')
    expect(humanAmountToBaseUnits('0.5', 18).toString()).to.equal('500000000000000000')
    expect(humanAmountToBaseUnits('0.0125', 18).toString()).to.equal('12500000000000000')
  })

  it('converts USDC (6 decimals)', () => {
    expect(humanAmountToBaseUnits('1', 6).toString()).to.equal('1000000')
    expect(humanAmountToBaseUnits('2.5', 6).toString()).to.equal('2500000')
    expect(humanAmountToBaseUnits('0.000001', 6).toString()).to.equal('1')
  })

  it('rejects zero, negative, empty, and malformed amounts', () => {
    expect(() => humanAmountToBaseUnits('0', 18)).to.throw()
    expect(() => humanAmountToBaseUnits('', 18)).to.throw()
    expect(() => humanAmountToBaseUnits('.', 18)).to.throw()
    expect(() => humanAmountToBaseUnits('-1', 18)).to.throw()
    expect(() => humanAmountToBaseUnits('abc', 18)).to.throw()
    expect(() => humanAmountToBaseUnits('1e18', 18)).to.throw()
  })

  it('rejects more decimal places than the token supports', () => {
    expect(() => humanAmountToBaseUnits('1.1234567', 6)).to.throw('decimal')
  })
})

describe('baseUnitsToHumanAmount', () => {
  it('formats base units back to a human amount', () => {
    expect(baseUnitsToHumanAmount('1000000000000000000', 18)).to.equal('1')
    expect(baseUnitsToHumanAmount('500000000000000000', 18)).to.equal('0.5')
    expect(baseUnitsToHumanAmount('2500000', 6)).to.equal('2.5')
    expect(baseUnitsToHumanAmount('0', 18)).to.equal('0')
  })

  it('respects max display decimals', () => {
    expect(baseUnitsToHumanAmount('1234567890123456789', 18, 4)).to.equal('1.2345')
  })

  it('round-trips with humanAmountToBaseUnits', () => {
    const base = humanAmountToBaseUnits('3.14159', 18)
    expect(baseUnitsToHumanAmount(base, 18)).to.equal('3.14159')
  })
})
