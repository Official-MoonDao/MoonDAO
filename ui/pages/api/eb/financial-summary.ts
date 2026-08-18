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
import { getProgramRevenue } from '@/lib/treasury/programRevenue'
import { getHistoricalRevenue } from '@/lib/treasury/revenue'

const DAY_MS = 86400000

/**
 * Value MoonDAO earns or controls that is deliberately absent from the revenue
 * total. Surfaced so the dashboard can say why a stream someone expects to see
 * is not adding to the number, rather than leaving them to wonder.
 */
const EXCLUDED_FROM_REVENUE = [
  {
    label: 'Uniswap v4 FeeHook fees',
    reason:
      'Distributed weekly to checked-in vMOONEY holders by the hook itself. The treasury never receives it, so it is a member benefit rather than DAO income.',
  },
  {
    label: 'DePrize 5% bet slice',
    reason:
      'Routed to the competition prize pool with the bettor as beneficiary. It funds the prize, not operations. Only the 1% trade fee can reach the treasury.',
  },
  {
    label: 'Launchpad 5% liquidity slice',
    reason:
      'Seeds each mission\u2019s Uniswap pool via its pool deployer. MoonDAO-controlled, but protocol-owned liquidity rather than spendable income.',
  },
  {
    label: 'Mission token vesting (17.5%)',
    reason:
      'Reserved mission tokens vest to the treasury over four years. Non-cash and unvested, so it cannot fund burn.',
  },
]

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
    const windowStart = now - 365 * DAY_MS
    const subs = await getCanonicalSubscriptionRevenue(windowStart, now, ethPrice)
    // Reuses the memoised treasury transaction list the call above warmed.
    const programs = await getProgramRevenue(windowStart, now, ethPrice)
    const revenueStreams = await getHistoricalRevenue(aum.defiData, 365)

    const citizenUSD = subs.citizen.totalUSD
    const teamUSD = subs.team.totalUSD
    const launchpadUSD = programs.launchpad.totalUSD
    const deprizeUSD = programs.deprize.totalUSD
    const defiFeesUSD = revenueStreams.defiRevenue
    const stakingUSD = revenueStreams.stakingRevenue
    const cashMeasuredUSD = citizenUSD + teamUSD + launchpadUSD + deprizeUSD
    const accruedMeasuredUSD = defiFeesUSD + stakingUSD
    const measuredAnnualRevenueUSD = cashMeasuredUSD + accruedMeasuredUSD

    if (programs.unclassified.totalUSD > 0) {
      warnings.push(
        `${
          programs.unclassified.txCount
        } treasury inflow(s) worth ${programs.unclassified.totalUSD.toFixed(
          0
        )} USD came from senders we don't attribute to a revenue stream. See "unattributed inflows" — a new fee route would appear here.`
      )
    }

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
    const cashAnnualUSD = revenueIsMeasured ? cashMeasuredUSD : STATED_ANNUAL_REVENUE_USD
    const accruedAnnualUSD = revenueIsMeasured ? accruedMeasuredUSD : 0

    // Only cash can offset operating cost. Accrued LP fees and staking yield
    // stay inside those positions and raise AUM instead of funding burn.
    const burn = computeBurnModel({
      quarterlyProjectBudgetUSD: PROJECT_CYCLE.budgetUSD,
      annualRevenueUSD: cashAnnualUSD,
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
      burn.annual.grossUSD > 0 ? cashAnnualUSD / burn.annual.grossUSD : 0

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
        // Every stream is listed even at zero, with the reason, so a missing
        // number reads as "not earning yet" rather than "not measured".
        streams: [
          {
            label: 'Citizen subscriptions',
            annualUSD: citizenUSD,
            txCount: subs.citizen.txCount,
            available: true,
            cash: true,
            basis: 'ETH from the Citizen NFT contract to the Arbitrum treasury.',
          },
          {
            label: 'Team subscriptions',
            annualUSD: teamUSD,
            txCount: subs.team.txCount,
            available: true,
            cash: true,
            basis: 'ETH from the Team NFT contract to the Arbitrum treasury.',
          },
          {
            label: 'Launchpad fees',
            annualUSD: launchpadUSD,
            txCount: programs.launchpad.txCount,
            available: programs.launchpad.available,
            cash: true,
            basis: programs.launchpad.note,
          },
          {
            label: 'Liquidity pool fees',
            annualUSD: defiFeesUSD,
            available: true,
            cash: false,
            basis:
              "MoonDAO's share of Uniswap pool fees, by its position's share of pool TVL. Accrues inside the LP position — it raises AUM and is not withdrawn to the Safe.",
          },
          {
            label: 'DePrize fees',
            annualUSD: deprizeUSD,
            txCount: programs.deprize.txCount,
            available: programs.deprize.available,
            cash: true,
            basis: programs.deprize.note,
          },
          {
            label: 'ETH staking yield',
            annualUSD: stakingUSD,
            available: true,
            cash: false,
            basis:
              'Beacon-chain validator performance over the trailing year. Accrues with the validators and cannot pay an invoice until they are exited.',
          },
          // When the measured streams are all zero the total is the MDP-249
          // stated figure — include it here so the breakdown sums to annualUSD.
          ...(!revenueIsMeasured
            ? [
                {
                  label: 'Stated (MDP-249)',
                  annualUSD: STATED_ANNUAL_REVENUE_USD,
                  available: true,
                  cash: true,
                  basis: 'Policy figure used because nothing measured on-chain.',
                },
              ]
            : []),
        ],
        // Only cash actually reaching a Safe can pay salaries. Accrued yield
        // raises AUM instead, so the two are reported separately rather than
        // blended into one number that overstates spendable income.
        cashAnnualUSD,
        accruedAnnualUSD,
        unattributedInflows: programs.unclassified,
        excluded: EXCLUDED_FROM_REVENUE,
        methodology:
          'Trailing 365 days. Cash streams are ETH that actually reached the Arbitrum treasury, matched by the sending contract. Accrued streams (LP fees, staking yield) are earned but stay inside the position, so they raise AUM rather than funding burn. ERC-20 inflows and revenue paid to non-treasury addresses are not counted.',
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
