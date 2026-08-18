/**
 * Executive finance helpers (headless, mocha + chai).
 *
 * Locks in monthly/annual burn assembly, cash-flow-positive runway, and
 * exhaustion-date arithmetic — including month-end overflow.
 */
import { expect } from 'chai'
import {
  EB_BONUS_POOL_MONTHLY_USD,
  STATED_ANNUAL_REVENUE_USD,
  computeBurnModel,
  getEbCoreMonthlyUSD,
  runwayExhaustionDate,
  runwayMonths,
} from 'const/executiveFinance'
import { ProgramSourceConfig, classifyTreasuryInflows } from '@/lib/treasury/programRevenue'

describe('executiveFinance', () => {
  describe('computeBurnModel', () => {
    it('assembles monthly and annual burn from the approved cost stack', () => {
      const quarterlyProjectBudgetUSD = 30000
      const annualRevenueUSD = 12000
      const burn = computeBurnModel({ quarterlyProjectBudgetUSD, annualRevenueUSD })

      const ebCoreMonthlyUSD = getEbCoreMonthlyUSD()
      const projectsMonthlyUSD = quarterlyProjectBudgetUSD / 3
      const grossMonthlyUSD = ebCoreMonthlyUSD + projectsMonthlyUSD
      const revenueMonthlyUSD = annualRevenueUSD / 12
      const netMonthlyUSD = grossMonthlyUSD - revenueMonthlyUSD

      expect(burn.ebCoreMonthlyUSD).to.equal(ebCoreMonthlyUSD)
      expect(burn.ebBonusMonthlyUSD).to.equal(EB_BONUS_POOL_MONTHLY_USD)
      expect(burn.projectsMonthlyUSD).to.equal(projectsMonthlyUSD)
      expect(burn.grossMonthlyUSD).to.equal(grossMonthlyUSD)
      expect(burn.revenueMonthlyUSD).to.equal(revenueMonthlyUSD)
      expect(burn.netMonthlyUSD).to.equal(netMonthlyUSD)
      expect(burn.netMonthlyWithBonusesUSD).to.equal(netMonthlyUSD + EB_BONUS_POOL_MONTHLY_USD)
      expect(burn.annual.grossUSD).to.equal(grossMonthlyUSD * 12)
      expect(burn.annual.revenueUSD).to.equal(annualRevenueUSD)
      expect(burn.annual.netUSD).to.equal(netMonthlyUSD * 12)
      expect(burn.annual.netWithBonusesUSD).to.equal(
        (netMonthlyUSD + EB_BONUS_POOL_MONTHLY_USD) * 12
      )
    })

    it('credits the stated MDP-249 figure when that is the annual revenue passed in', () => {
      const burn = computeBurnModel({
        quarterlyProjectBudgetUSD: 24310,
        annualRevenueUSD: STATED_ANNUAL_REVENUE_USD,
      })
      expect(burn.annual.revenueUSD).to.equal(STATED_ANNUAL_REVENUE_USD)
      expect(burn.revenueMonthlyUSD).to.equal(STATED_ANNUAL_REVENUE_USD / 12)
    })
  })

  describe('runwayMonths', () => {
    it('divides assets by net monthly burn', () => {
      expect(runwayMonths(120000, 10000)).to.equal(12)
    })

    it('returns null when net burn is zero or negative (cash-flow positive)', () => {
      expect(runwayMonths(100000, 0)).to.equal(null)
      expect(runwayMonths(100000, -100)).to.equal(null)
    })

    it('returns 0 when there are no assets left to burn', () => {
      expect(runwayMonths(0, 10000)).to.equal(0)
    })
  })

  describe('runwayExhaustionDate', () => {
    it('returns null when cash-flow positive', () => {
      expect(runwayExhaustionDate(100000, 0, new Date(Date.UTC(2026, 0, 15)))).to.equal(null)
    })

    it('adds whole months without overflowing month-end start dates', () => {
      const from = new Date(Date.UTC(2026, 0, 31))
      const exhausted = runwayExhaustionDate(100, 100, from)
      expect(exhausted).to.not.equal(null)
      expect(exhausted!.toISOString().slice(0, 10)).to.equal('2026-02-28')
    })

    it('keeps mid-month dates on the same day of the target month', () => {
      const from = new Date(Date.UTC(2026, 0, 15))
      const exhausted = runwayExhaustionDate(100, 100, from)
      expect(exhausted).to.not.equal(null)
      expect(exhausted!.toISOString().slice(0, 10)).to.equal('2026-02-15')
    })

    it('adds the fractional-month day count after clamping', () => {
      const from = new Date(Date.UTC(2026, 0, 31))
      // 1.5 months: clamp 31 Jan → 28 Feb, then +15 days → 15 Mar
      const exhausted = runwayExhaustionDate(150, 100, from)
      expect(exhausted).to.not.equal(null)
      expect(exhausted!.toISOString().slice(0, 10)).to.equal('2026-03-15')
    })
  })
})

describe('classifyTreasuryInflows', () => {
  const CITIZEN = '0xC1717777777777777777777777777777777777C1'
  const TEAM = '0xTEAM000000000000000000000000000000000000'.replace('TEAM', 'a11a')
  const TERMINAL = '0xJB0000000000000000000000000000000000000b'.replace('JB', 'b2')
  const ROUTER = '0xd3d3000000000000000000000000000000000003'
  const SAFE = '0x5afe000000000000000000000000000000000005'
  const STRANGER = '0x9999000000000000000000000000000000000009'

  const sources: ProgramSourceConfig = {
    citizen: [CITIZEN],
    team: [TEAM],
    launchpad: [TERMINAL, ''],
    deprize: [ROUTER],
    internal: [SAFE],
  }

  const tx = (from: string, valueETH: number, hash = from + valueETH) => ({
    from,
    valueETH,
    timestamp: 1,
    hash,
  })

  it('buckets each program by the sender that routed the ETH', () => {
    const out = classifyTreasuryInflows(
      [tx(CITIZEN, 1), tx(CITIZEN, 2), tx(TEAM, 3), tx(TERMINAL, 4), tx(ROUTER, 5)],
      sources
    )

    expect(out.buckets.citizen).to.deep.equal({ totalETH: 3, txCount: 2 })
    expect(out.buckets.team).to.deep.equal({ totalETH: 3, txCount: 1 })
    expect(out.buckets.launchpad).to.deep.equal({ totalETH: 4, txCount: 1 })
    expect(out.buckets.deprize).to.deep.equal({ totalETH: 5, txCount: 1 })
    expect(out.unclassified.totalETH).to.equal(0)
  })

  it('matches senders case-insensitively', () => {
    const out = classifyTreasuryInflows([tx(CITIZEN.toUpperCase(), 1)], sources)
    expect(out.buckets.citizen.totalETH).to.equal(1)
    expect(out.unclassified.txCount).to.equal(0)
  })

  it('keeps transfers between MoonDAO safes out of every revenue bucket', () => {
    const out = classifyTreasuryInflows([tx(SAFE, 10)], sources)
    expect(out.internalTransfers).to.deep.equal({ totalETH: 10, txCount: 1 })
    expect(out.unclassified.totalETH).to.equal(0)
    const revenueTotal = Object.values(out.buckets).reduce((s, b) => s + b.totalETH, 0)
    expect(revenueTotal).to.equal(0)
  })

  it('surfaces unknown senders instead of absorbing them into a stream', () => {
    const out = classifyTreasuryInflows([tx(STRANGER, 7), tx(STRANGER, 3)], sources)
    expect(out.unclassified.totalETH).to.equal(10)
    expect(out.unclassified.txCount).to.equal(2)
    expect(out.unclassified.topSources[0]).to.deep.equal({
      address: STRANGER.toLowerCase(),
      totalETH: 10,
      txCount: 2,
    })
    const revenueTotal = Object.values(out.buckets).reduce((s, b) => s + b.totalETH, 0)
    expect(revenueTotal).to.equal(0)
  })

  it('ranks unattributed senders by value and caps the list', () => {
    const out = classifyTreasuryInflows(
      [tx('0xaaa1', 1), tx('0xbbb2', 9), tx('0xccc3', 5)],
      sources,
      2
    )
    expect(out.unclassified.topSources.map((s) => s.address)).to.deep.equal(['0xbbb2', '0xccc3'])
  })

  it('ignores zero-value transfers', () => {
    const out = classifyTreasuryInflows([tx(CITIZEN, 0), tx(STRANGER, 0)], sources)
    expect(out.buckets.citizen.txCount).to.equal(0)
    expect(out.unclassified.txCount).to.equal(0)
  })

  it('does not treat an unconfigured program address as a wildcard match', () => {
    // `launchpad` carries an empty string for chains without a terminal. An
    // inflow from an unrelated sender must not be attributed to it.
    const out = classifyTreasuryInflows([tx(STRANGER, 2)], sources)
    expect(out.buckets.launchpad.totalETH).to.equal(0)
    expect(out.unclassified.totalETH).to.equal(2)
  })
})
