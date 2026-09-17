import { MarketStage } from '@/lib/deprize/constants'
import {
  ARBITRUM_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  getFundingStrategy,
} from '@/lib/deprize/fundingStrategy'
import { marketAcceptsBets } from '@/lib/deprize/marketGates'
import {
  buildOnrampReturnUrl,
  isSafeAmountString,
  parseOnrampReturn,
} from '@/lib/deprize/onrampReturn'
import { resolveOnrampReturn } from '@/lib/deprize/resolveOnrampReturn'

const capEth = 1
const baseResolve = {
  jwtVerified: true,
  jwtAddress: '0xabc',
  jwtIssuedAtMs: 1_000,
  jwtConsumed: false,
  nowMs: 2_000,
  userAddress: '0xabc',
  numOutcomes: 6,
  marketAcceptsBets: true,
  spendableEthAtReturn: 0.01,
  spendableEthNow: 0.05,
  capEth,
}

describe('getFundingStrategy', () => {
  it('maps Arbitrum to MoonPay onramp, Sepolia to faucet, else none', () => {
    const arb = getFundingStrategy(ARBITRUM_CHAIN_ID)
    expect(arb.kind).to.equal('onramp')
    if (arb.kind === 'onramp') expect(arb.defaultProvider).to.equal('moonpay')
    expect(getFundingStrategy(SEPOLIA_CHAIN_ID)).to.deep.equal({
      kind: 'faucet',
      faucetUrl: 'https://sepoliafaucet.com',
    })
    expect(getFundingStrategy(1)).to.deep.equal({ kind: 'none' })
  })
})

describe('marketAcceptsBets', () => {
  const ok = {
    bettingOpen: true,
    mintBound: true,
    mintConfigured: true,
    tradingHalted: false,
    stage: MarketStage.Running,
  }

  it('is true only when every market term holds', () => {
    expect(marketAcceptsBets(ok)).to.equal(true)
    expect(marketAcceptsBets({ ...ok, bettingOpen: false })).to.equal(false)
    expect(marketAcceptsBets({ ...ok, mintBound: false })).to.equal(false)
    expect(marketAcceptsBets({ ...ok, mintConfigured: false })).to.equal(false)
    expect(marketAcceptsBets({ ...ok, tradingHalted: true })).to.equal(false)
    expect(marketAcceptsBets({ ...ok, stage: MarketStage.Paused })).to.equal(false)
    expect(marketAcceptsBets({ ...ok, stage: MarketStage.Closed })).to.equal(false)
  })
})

describe('onramp return URL helpers', () => {
  it('round-trips 18-decimal amounts and drops amount when none was typed', () => {
    const withAmount = buildOnrampReturnUrl({
      origin: 'https://moondao.com',
      deprizeId: 22,
      outcomeIndex: 3,
      amountEth: '0.123456789012345678',
      capEth: '1',
    })
    const parsed = parseOnrampReturn(Object.fromEntries(new URL(withAmount).searchParams))
    expect(parsed).to.deep.equal({
      active: true,
      outcomeIndex: 3,
      amountEth: '0.123456789012345678',
    })

    const noAmount = buildOnrampReturnUrl({
      origin: 'https://moondao.com',
      deprizeId: 22,
      outcomeIndex: 1,
      capEth: '1',
    })
    expect(parseOnrampReturn(Object.fromEntries(new URL(noAmount).searchParams))).to.deep.equal({
      active: true,
      outcomeIndex: 1,
    })
    expect(noAmount).to.not.include('amount=')
  })

  it('rejects scientific notation, 40-digit decimals, and over-long strings', () => {
    expect(isSafeAmountString('1e-6')).to.equal(false)
    expect(isSafeAmountString(`0.${'1'.repeat(40)}`)).to.equal(false)
    expect(isSafeAmountString('1'.repeat(40))).to.equal(false)
    expect(parseOnrampReturn({ onrampSuccess: 'true', outcome: '0', amount: '1e-6' })).to.deep.equal(
      { active: false }
    )
  })
})

describe('resolveOnrampReturn', () => {
  it('1 — onrampSuccess without a verified JWT is ignore', () => {
    const parsed = parseOnrampReturn({
      onrampSuccess: 'true',
      outcome: '3',
      amount: '0.99',
    })
    expect(
      resolveOnrampReturn({ ...baseResolve, parsed, jwtVerified: false }).action
    ).to.equal('ignore')
  })

  it('2 — JWT address mismatch strips and names the funded wallet', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 1 },
      jwtAddress: '0xfunded',
      userAddress: '0xother',
    })
    expect(result.action).to.equal('strip')
    expect(result.notice).to.deep.equal({
      kind: 'wrong-wallet',
      fundedAddress: '0xfunded',
    })
  })

  it('3 — stale JWT strips with no banner', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 1 },
      jwtIssuedAtMs: 0,
      nowMs: 60 * 60 * 1000 + 1,
    })
    expect(result).to.deep.equal({ action: 'strip' })
  })

  it('4 — out-of-range outcome strips and never opens', () => {
    expect(
      resolveOnrampReturn({
        ...baseResolve,
        parsed: { active: true, outcomeIndex: 6 },
      }).action
    ).to.equal('strip')
    expect(
      resolveOnrampReturn({
        ...baseResolve,
        parsed: { active: true, outcomeIndex: -1 },
      }).action
    ).to.equal('strip')
  })

  it('5 — amount above the cap opens with a clamped prefill', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 2, amountEth: '9' },
    })
    expect(result.action).to.equal('open')
    expect(result.prefillEth).to.equal('1')
  })

  it('6 — market closed ignores and never opens', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 1 },
      marketAcceptsBets: false,
    })
    expect(result.action).to.equal('ignore')
    expect(result.notice?.kind).to.equal('market-closed')
  })

  it('7 — no balance delta means fundsArrived false even for dust amounts', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 1, amountEth: '0.000001' },
      spendableEthAtReturn: 0.1,
      spendableEthNow: 0.1,
    })
    expect(result.action).to.equal('open')
    expect(result.fundsArrived).to.equal(false)
  })

  it('8 — short delta opens without a funds-arrived banner', () => {
    const result = resolveOnrampReturn({
      ...baseResolve,
      parsed: { active: true, outcomeIndex: 1, amountEth: '0.2' },
      spendableEthAtReturn: 0,
      spendableEthNow: 0.05,
    })
    expect(result.action).to.equal('open')
    expect(result.fundsArrived).to.equal(false)
    expect(result.notice?.kind).to.equal('shortfall')
    if (result.notice?.kind === 'shortfall') {
      expect(result.notice.shortfallEth).to.be.closeTo(0.15, 1e-12)
    }
  })

  it('9 — a consumed JWT is ignore', () => {
    expect(
      resolveOnrampReturn({
        ...baseResolve,
        parsed: { active: true, outcomeIndex: 1 },
        jwtConsumed: true,
      }).action
    ).to.equal('ignore')
  })
})
