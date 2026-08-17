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
