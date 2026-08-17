/**
 * Executive financial summary — assets, revenue, burn, runway.
 *
 * Powers `/admin/financial-overview`. Gated to the `OPERATORS` allowlist
 * because it combines public on-chain positions with the DAO's approved
 * cost stack into the organisation's cash-position picture.
 *
 * Assets and revenue are read live from the same helpers `/api/eb/audit`
 * uses, so the two endpoints can't disagree. Cost comes from
 * `const/executiveFinance.ts` (governance-approved budgets).
 *
 * Usage:  GET /api/eb/financial-summary
 */
import { PROJECT_CYCLE } from 'const/config'
import {
  computeBurnModel,
  EB_BUDGET_SOURCE,
  EB_CORE_LINES,
  runwayExhaustionDate,
  runwayMonths,
  STATED_ANNUAL_REVENUE_USD,
} from 'const/executiveFinance'
import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getETHPrice } from '@/lib/etherscan'
import { getAUMHistoryOnchain } from '@/lib/treasury/aum-onchain'
import { getCanonicalSubscriptionRevenue } from '@/lib/treasury/canonicalRevenue'
import { getHistoricalRevenue } from '@/lib/treasury/revenue'

const DAY_MS = 86400000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const now = Date.now()
    const warnings: string[] = []

    const [aum, ethPrice] = await Promise.all([getAUMHistoryOnchain(365), getETHPrice()])

    if (!aum.aum) {
      warnings.push(
        'On-chain AUM read returned zero — check NEXT_PUBLIC_ETHERSCAN_API_KEY and the Safe API.'
      )
    }
    if (!ethPrice) {
      warnings.push('ETH price unavailable — ETH-denominated figures are omitted.')
    }

    // Subscription revenue comes from the canonical on-chain helper rather
    // than getHistoricalRevenue, whose cached pipeline can silently return $0
    // under Etherscan rate limits. DeFi fees and staking yield have no
    // canonical equivalent, so they come from the revenue pipeline.
    const subs = await getCanonicalSubscriptionRevenue(now - 365 * DAY_MS, now, ethPrice)
    const revenueStreams = await getHistoricalRevenue(aum.defiData, 365)

    const citizenUSD = subs.citizen.totalUSD
    const teamUSD = subs.team.totalUSD
    const defiFeesUSD = revenueStreams.defiRevenue
    const stakingUSD = revenueStreams.stakingRevenue
    const measuredAnnualRevenueUSD = citizenUSD + teamUSD + defiFeesUSD + stakingUSD

    // Fall back to the MDP-249 policy figure only if nothing measured, so the
    // burn model never credits $0 revenue against costs on a failed read.
    const revenueIsMeasured = measuredAnnualRevenueUSD > 0
    if (!revenueIsMeasured) {
      warnings.push(
        'No on-chain revenue measured for the trailing year — using the stated MDP-249 figure.'
      )
    }
    const annualRevenueUSD = revenueIsMeasured
      ? measuredAnnualRevenueUSD
      : STATED_ANNUAL_REVENUE_USD

    const burn = computeBurnModel({
      quarterlyProjectBudgetUSD: PROJECT_CYCLE.budgetUSD,
      annualRevenueUSD,
    })

    // Official AUM excludes staked ETH (restricted — it cannot pay invoices).
    // Both bases are reported because the difference is material to runway.
    const liquidUSD = aum.aum
    const withStakedUSD = aum.aum + aum.stakedEth.currentUsd

    const scenario = (assetsUSD: number, netMonthlyUSD: number) => {
      const months = runwayMonths(assetsUSD, netMonthlyUSD)
      const exhaustion = runwayExhaustionDate(assetsUSD, netMonthlyUSD, new Date(now))
      return {
        assetsUSD,
        netMonthlyBurnUSD: netMonthlyUSD,
        months,
        exhaustionDate: exhaustion ? exhaustion.toISOString().slice(0, 10) : null,
      }
    }

    // Revenue as a share of gross cost — the single number that says how far
    // the DAO is from covering its own operations.
    const revenueCoverageRatio =
      burn.annual.grossUSD > 0 ? annualRevenueUSD / burn.annual.grossUSD : 0

    res.setHeader('Cache-Control', 'private, no-store')

    return res.status(200).json({
      meta: {
        calculatedAt: new Date(now).toISOString(),
        ethPriceUSD: ethPrice,
        basis:
          'Assets and revenue read live on-chain. Cost is the governance-approved budget stack, held constant.',
        warnings,
      },
      assets: {
        // Official AUM policy: eight designated Safes on their home chains
        // plus the WETH side of the Uniswap V3 position, excluding MOONEY.
        liquidUSD,
        stakedEth: {
          ethStaked: aum.stakedEth.ethStaked,
          activeValidators: aum.stakedEth.activeCount,
          usd: aum.stakedEth.currentUsd,
          note: 'Restricted — excluded from official AUM until validators are exited.',
        },
        defiLpUSD: aum.defiData.balance,
        totalRecognizedUSD: withStakedUSD,
        history: aum.aumHistory,
      },
      revenue: {
        annualUSD: annualRevenueUSD,
        monthlyUSD: annualRevenueUSD / 12,
        isMeasured: revenueIsMeasured,
        statedAnnualUSD: STATED_ANNUAL_REVENUE_USD,
        coverageOfGrossBurn: revenueCoverageRatio,
        streams: [
          { label: 'Citizen subscriptions', annualUSD: citizenUSD, txCount: subs.citizen.txCount },
          { label: 'Team subscriptions', annualUSD: teamUSD, txCount: subs.team.txCount },
          { label: 'Liquidity pool fees', annualUSD: defiFeesUSD },
          { label: 'ETH staking yield', annualUSD: stakingUSD },
        ],
        source: subs.source,
      },
      burn: {
        ...burn,
        ebCoreLines: EB_CORE_LINES,
        ebBudgetSource: EB_BUDGET_SOURCE,
        projectsBasis: {
          quarterlyBudgetUSD: PROJECT_CYCLE.budgetUSD,
          quarter: PROJECT_CYCLE.quarter,
          year: PROJECT_CYCLE.year,
          note: '5% of liquid non-MOONEY assets per quarter, restated each cycle.',
        },
      },
      runway: {
        primary: scenario(liquidUSD, burn.netMonthlyUSD),
        scenarios: [
          {
            label: 'Liquid assets, base burn',
            ...scenario(liquidUSD, burn.netMonthlyUSD),
          },
          {
            label: 'Liquid assets, bonuses paid',
            ...scenario(liquidUSD, burn.netMonthlyWithBonusesUSD),
          },
          {
            label: 'Liquid + staked ETH, base burn',
            ...scenario(withStakedUSD, burn.netMonthlyUSD),
          },
          {
            label: 'Liquid + staked ETH, bonuses paid',
            ...scenario(withStakedUSD, burn.netMonthlyWithBonusesUSD),
          },
        ],
      },
    })
  } catch (err: any) {
    console.error('[eb/financial-summary]', err)
    return res.status(500).json({ error: err?.message || 'financial summary failed' })
  }
}

// Gated by the hard-coded `OPERATORS` allowlist in `const/config.ts`.
export default withMiddleware(handler, isOperator)
