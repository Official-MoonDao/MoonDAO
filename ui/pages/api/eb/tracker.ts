/**
 * EB Tracker — Baseline Metrics Snapshot
 *
 * Freezes the baseline subscriber counts captured on 2026-05-27
 * (Citizens 199, Teams 20) alongside live trailing-30-day revenue
 * and per-tier monthly subscription costs, so the EB can track
 * growth against a fixed reference point.
 *
 * Usage:  GET /api/eb/tracker
 *
 * All revenue figures come from the same canonical on-chain pipeline
 * used by /api/eb/audit — Etherscan v2 internal txs on Arbitrum.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { getCanonicalSubscriptionRevenue } from '@/lib/treasury/canonicalRevenue'
import { TEAM_DISCOUNT } from '@/lib/treasury/arr'
import { getETHPrice } from '@/lib/etherscan'
import CitizenABI from 'const/abis/Citizen.json'
import TeamABI from 'const/abis/Team.json'
import { CITIZEN_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { arbitrum } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'

// ─── Frozen baseline (captured 2026-05-27) ───────────────────────────────────
const BASELINE = {
  capturedAt: '2026-05-27',
  citizens: 199,
  teams: 20,
} as const

// 30-day month: this is a deliberate "monthly cost" approximation, NOT 1/12 of
// a calendar year. Multiplying baselineMonthlyTotal × 12 yields a 360-day
// figure (~1.4% short of a true annual run-rate, which arr.ts derives with
// 365.25 days). Use the annual contract price directly for run-rate, not ×12.
const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

interface SubscriptionPrices {
  citizenPerMonth: number
  teamPerMonth: number
  // 'onchain' = read live from the NFT contracts; 'fallback' = hardcoded
  // estimate used when the RPC read failed. Surfaced in the JSON so a consumer
  // can tell whether the prices are authoritative.
  source: 'onchain' | 'fallback'
}

async function getSubscriptionPricesETH(): Promise<SubscriptionPrices> {
  try {
    const chain = arbitrum
    const chainSlug = getChainSlug(chain)

    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      chain,
      abi: CitizenABI as any,
    })
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain,
      abi: TeamABI as any,
    })

    const [citizenPricePerSecond, teamPricePerSecond] = await Promise.all([
      readContract({ contract: citizenContract, method: 'pricePerSecond' }),
      readContract({ contract: teamContract, method: 'pricePerSecond' }),
    ])

    return {
      // TEAM_DISCOUNT (imported from arr.ts) is applied to the team contract's
      // raw pricePerSecond because the team UX charges ~0.0333 ETH/yr, not the
      // ~0.493 ETH/yr the raw value implies. Without it the cost is 14.8× high.
      citizenPerMonth: (Number(citizenPricePerSecond) * SECONDS_PER_MONTH) / 1e18,
      teamPerMonth: (Number(teamPricePerSecond) * SECONDS_PER_MONTH * TEAM_DISCOUNT) / 1e18,
      source: 'onchain',
    }
  } catch (err) {
    console.error('[eb/tracker] pricePerSecond read failed, using fallback:', err)
    // Fallback to known values if RPC unavailable
    // citizen: 0.0111 ETH/year → 0.0111×(30/365) = 0.000912 ETH/month
    // team:    0.0333 ETH/year → 0.0333×(30/365) = 0.002737 ETH/month
    return {
      citizenPerMonth: 0.000912,
      teamPerMonth: 0.002737,
      source: 'fallback',
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    const trailing30dStart  = now - 30  * 24 * 60 * 60 * 1000
    const trailing365dStart = now - 365 * 24 * 60 * 60 * 1000

    const [ethPrice, prices] = await Promise.all([
      getETHPrice(),
      getSubscriptionPricesETH(),
    ])

    // getETHPrice() returns 0 on failure. Bail rather than silently emitting
    // $0 for every USD field while the ETH figures look correct.
    if (!ethPrice || ethPrice <= 0) {
      return res
        .status(502)
        .json({ error: 'ETH price unavailable — refusing to emit $0 USD metrics' })
    }

    // NOTE: these run sequentially on purpose. canonicalRevenue.ts memoises the
    // Etherscan response but has no in-flight dedup, so running both in
    // Promise.all on a cold cache would fire two identical requests and can
    // trip the free-tier rate limit. The first await warms `memo`; the second
    // reuses it for free.
    const trailing30d = await getCanonicalSubscriptionRevenue(
      trailing30dStart,
      now,
      ethPrice
    )
    const trailing365d = await getCanonicalSubscriptionRevenue(
      trailing365dStart,
      now,
      ethPrice
    )

    // Monthly cost for ALL baseline subscribers at current on-chain prices
    const monthlySubscriptionCostETH =
      BASELINE.citizens * prices.citizenPerMonth +
      BASELINE.teams * prices.teamPerMonth

    // Underlying data changes slowly and is memoised for 10min server-side.
    // Let the CDN serve repeated EB/dashboard polls instead of re-invoking.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300')

    res.status(200).json({
      meta: {
        description: 'EB Tracker — frozen baseline + live trailing-30d / trailing-365d metrics',
        calculatedAt: new Date(now).toISOString(),
        ethPriceUSD: ethPrice,
      },
      baseline: {
        capturedAt: BASELINE.capturedAt,
        citizens: BASELINE.citizens,
        teams: BASELINE.teams,
        note: 'Active subscriber counts frozen on 2026-05-27 as EB programme reference point.',
      },
      subscriptionCosts: {
        source: 'on-chain pricePerSecond from Citizen/Team NFT contracts on Arbitrum',
        pricesSource: prices.source,
        perTierPerMonth: {
          citizenETH: prices.citizenPerMonth,
          citizenUSD: prices.citizenPerMonth * ethPrice,
          teamETH: prices.teamPerMonth,
          teamUSD: prices.teamPerMonth * ethPrice,
        },
        baselineMonthlyTotal: {
          eth: monthlySubscriptionCostETH,
          usd: monthlySubscriptionCostETH * ethPrice,
          breakdown: `${BASELINE.citizens} citizens × ${prices.citizenPerMonth.toFixed(6)} ETH + ${BASELINE.teams} teams × ${prices.teamPerMonth.toFixed(6)} ETH`,
        },
      },
      trailing30d: {
        note: 'Noisy for annual subs — use trailing365d for run-rate revenue.',
        rangeStart: new Date(trailing30dStart).toISOString(),
        rangeEnd: new Date(now).toISOString(),
        citizen: {
          txCount: trailing30d.citizen.txCount,
          totalETH: trailing30d.citizen.totalETH,
          totalUSD: trailing30d.citizen.totalUSD,
        },
        team: {
          txCount: trailing30d.team.txCount,
          totalETH: trailing30d.team.totalETH,
          totalUSD: trailing30d.team.totalUSD,
        },
        totalETH: trailing30d.totalETH,
        totalUSD: trailing30d.totalUSD,
        source: trailing30d.source,
      },
      trailing365d: {
        note: 'Preferred run-rate metric — covers one full renewal cycle for annual subs.',
        rangeStart: new Date(trailing365dStart).toISOString(),
        rangeEnd: new Date(now).toISOString(),
        citizen: {
          txCount: trailing365d.citizen.txCount,
          totalETH: trailing365d.citizen.totalETH,
          totalUSD: trailing365d.citizen.totalUSD,
        },
        team: {
          txCount: trailing365d.team.txCount,
          totalETH: trailing365d.team.totalETH,
          totalUSD: trailing365d.team.totalUSD,
        },
        totalETH: trailing365d.totalETH,
        totalUSD: trailing365d.totalUSD,
        source: trailing365d.source,
      },
    })
  } catch (err: any) {
    console.error('[eb/tracker]', err)
    res.status(500).json({ error: err?.message || 'tracker failed' })
  }
}
