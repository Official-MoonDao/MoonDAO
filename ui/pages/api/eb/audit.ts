/**
 * EB Rewards Audit Endpoint
 *
 * Exposes every intermediate value used in the Q4 EB reward calculation
 * so a third party can reproduce the math from public on-chain sources.
 *
 * Usage:  GET /api/eb/audit?quarter=4&year=2025
 *
 * Returned fields are organised so a human can verify each number against:
 *   - Etherscan (transfers + token balances)
 *   - Safe Transaction Service (current portfolio totals)
 *   - DefiLlama coins API (historical USD prices)
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { getAUMHistoryOnchain } from '@/lib/treasury/aum-onchain'
import { getHistoricalRevenue } from '@/lib/treasury/revenue'
import { getCanonicalSubscriptionRevenue } from '@/lib/treasury/canonicalRevenue'
import { getETHPrice } from '@/lib/etherscan'

function quarterRange(q: number, y: number) {
  const startMonth = (q - 1) * 3
  const startDate = new Date(Date.UTC(y, startMonth, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(y, startMonth + 3, 0, 23, 59, 59, 999))
  return { startMs: startDate.getTime(), endMs: endDate.getTime(), startDate, endDate }
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = parseInt((req.query.quarter as string) || '4', 10)
    const y = parseInt((req.query.year as string) || '2025', 10)
    const cur = quarterRange(q, y)
    const prev = q === 1 ? quarterRange(4, y - 1) : quarterRange(q - 1, y)

    const days = Math.ceil((cur.endMs - prev.startMs) / 86400000) + 30
    const aum = await getAUMHistoryOnchain(
      days,
      prev.startMs - 7 * 86400000,
      cur.endMs
    )

    const inRange = (t: number, s: number, e: number) =>
      t >= s && t <= e

    const curPoints = aum.aumHistory.filter((p) =>
      inRange(p.timestamp * 1000, cur.startMs, cur.endMs)
    )
    const prevPoints = aum.aumHistory.filter((p) =>
      inRange(p.timestamp * 1000, prev.startMs, prev.endMs)
    )

    const curAvg = avg(curPoints.map((p) => p.value))
    const prevAvg = avg(prevPoints.map((p) => p.value))

    const ethPrice = await getETHPrice()

    // Canonical subscription revenue (on-chain Arbitrum internal txs).
    // The cached `getHistoricalRevenue` pipeline can silently return $0 on
    // Etherscan rate-limits, so we always re-derive subscription revenue
    // straight from public on-chain data here.
    const yearAgoEnd = Math.min(cur.endMs, Date.now())
    const yearAgoStart = yearAgoEnd - 365 * 86400000
    const [quarterSubs, annualSubs, revenueData] = await Promise.all([
      getCanonicalSubscriptionRevenue(cur.startMs, cur.endMs, ethPrice),
      getCanonicalSubscriptionRevenue(yearAgoStart, yearAgoEnd, ethPrice),
      getHistoricalRevenue(aum.defiData, 365), // for DeFi fees + staking only
    ])

    // DeFi fees and staking come from getHistoricalRevenue (subgraph + beacon
    // chain — both deterministic). Subscription numbers come from the
    // canonical on-chain helper.
    const defiFeesUSD = revenueData.defiRevenue
    const stakingUSD = revenueData.stakingRevenue

    const quarterRevenue = quarterSubs.totalUSD
    // (DeFi fees in a single quarter aren't pulled from the subgraph here —
    // they are dominated by subscription flow and are accounted for in the
    // annual figure used for the revenue reward. Treasury growth subtracts
    // only realised cash inflows.)

    const revStart = 0 // canonical helper returns the delta directly
    const revEnd = quarterRevenue

    const rawGrowthUSD = curAvg - prevAvg
    const capitalGainsUSD = rawGrowthUSD - quarterRevenue
    const treasuryRewardUSD = capitalGainsUSD > 0 ? capitalGainsUSD * 0.02 : 0
    const annualRevenueUSD =
      annualSubs.citizen.totalUSD +
      annualSubs.team.totalUSD +
      defiFeesUSD +
      stakingUSD
    const revenueRewardUSD = annualRevenueUSD * 0.1

    res.status(200).json({
      meta: {
        quarter: q,
        year: y,
        currentQuarterRange: {
          start: cur.startDate.toISOString(),
          end: cur.endDate.toISOString(),
        },
        previousQuarterRange: {
          start: prev.startDate.toISOString(),
          end: prev.endDate.toISOString(),
        },
        ethPriceUSD: ethPrice,
        calculatedAt: new Date().toISOString(),
      },
      sources: {
        balances: 'https://safe-client.safe.global/v1/chains/{chainId}/safes/{address}/balances/usd?trusted=true',
        transfers: 'https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=txlist|txlistinternal|tokentx&address={address}',
        prices: 'https://coins.llama.fi/chart/{coinKey}?start={unixSec}&span={N}&period=1d',
        uniswapV3NPM: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      },
      currentSnapshot: {
        totalAumUSD: aum.aum,
        defiBalanceUSD: aum.defiData.balance,
        firstPoolCreationTimestamp: aum.defiData.firstPoolCreationTimestamp,
        defiPositions: aum.defiData.protocols.flatMap((p) =>
          p.investments.map((inv) => ({
            chain: p.chain,
            id: inv.id,
            symbols: inv.symbols,
            poolAddress: inv.poolAddress,
            valueUSD: inv.value.USD,
          }))
        ),
        stakedEthSideMetric: aum.stakedEth,
      },
      currentQuarter: {
        averageUSD: curAvg,
        dataPointCount: curPoints.length,
        dailySeries: curPoints.map((p) => ({
          date: new Date(p.timestamp * 1000).toISOString().slice(0, 10),
          valueUSD: p.value,
        })),
      },
      previousQuarter: {
        averageUSD: prevAvg,
        dataPointCount: prevPoints.length,
        dailySeries: prevPoints.map((p) => ({
          date: new Date(p.timestamp * 1000).toISOString().slice(0, 10),
          valueUSD: p.value,
        })),
      },
      revenue: {
        source: quarterSubs.source,
        quarter: {
          rangeStart: new Date(quarterSubs.startMs).toISOString(),
          rangeEnd: new Date(quarterSubs.endMs).toISOString(),
          citizen: {
            txCount: quarterSubs.citizen.txCount,
            totalETH: quarterSubs.citizen.totalETH,
            totalUSD: quarterSubs.citizen.totalUSD,
            transactions: quarterSubs.citizen.transactions,
          },
          team: {
            txCount: quarterSubs.team.txCount,
            totalETH: quarterSubs.team.totalETH,
            totalUSD: quarterSubs.team.totalUSD,
            transactions: quarterSubs.team.transactions,
          },
          totalUSD: quarterRevenue,
        },
        annualBreakdown: {
          rangeStart: new Date(annualSubs.startMs).toISOString(),
          rangeEnd: new Date(annualSubs.endMs).toISOString(),
          citizenSubscriptions: {
            txCount: annualSubs.citizen.txCount,
            totalETH: annualSubs.citizen.totalETH,
            totalUSD: annualSubs.citizen.totalUSD,
          },
          teamSubscriptions: {
            txCount: annualSubs.team.txCount,
            totalETH: annualSubs.team.totalETH,
            totalUSD: annualSubs.team.totalUSD,
          },
          defiFeesUSD,
          stakingUSD,
          totalUSD: annualRevenueUSD,
        },
      },
      formula: {
        step1: 'avg(Q_current daily AUM) - avg(Q_previous daily AUM) = rawTreasuryChange',
        step2: 'rawTreasuryChange - quarterRevenue = capitalGains',
        step3: 'treasuryReward = max(capitalGains, 0) * 2%',
        step4: 'revenueReward = trailingAnnualRevenue * 10%',
        step5: 'totalRewardETH = (treasuryReward + revenueReward) / ethPrice',
      },
      result: {
        rawTreasuryChangeUSD: rawGrowthUSD,
        quarterRevenueUSD: quarterRevenue,
        capitalGainsUSD: capitalGainsUSD,
        treasuryRewardUSD,
        treasuryRewardETH: ethPrice ? treasuryRewardUSD / ethPrice : 0,
        annualRevenueUSD,
        revenueRewardUSD,
        revenueRewardETH: ethPrice ? revenueRewardUSD / ethPrice : 0,
        totalRewardETH:
          ethPrice
            ? (treasuryRewardUSD + revenueRewardUSD) / ethPrice
            : 0,
      },
    })
  } catch (err: any) {
    console.error('[audit]', err)
    res.status(500).json({ error: err?.message || 'audit failed' })
  }
}
