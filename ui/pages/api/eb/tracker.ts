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

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60 // 30-day month approximation

// arr.ts applies this factor to the team contract's raw pricePerSecond because
// the team subscription UX charges ~0.0333 ETH/yr (not the ~0.493 ETH/yr the
// raw pricePerSecond would imply at face value).  Without it the displayed cost
// is 14.8× too high.  Keep in sync with TEAM_DISCOUNT in lib/treasury/arr.ts.
const TEAM_PRICE_DISCOUNT = 0.067

async function getSubscriptionPricesETH(): Promise<{
  citizenPerMonth: number
  teamPerMonth: number
}> {
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
      citizenPerMonth: (Number(citizenPricePerSecond) * SECONDS_PER_MONTH) / 1e18,
      teamPerMonth: (Number(teamPricePerSecond) * SECONDS_PER_MONTH * TEAM_PRICE_DISCOUNT) / 1e18,
    }
  } catch {
    // Fallback to known values if RPC unavailable
    // citizen: 0.0111 ETH/year → 0.0111×(30/365) = 0.000912 ETH/month
    // team:    0.0333 ETH/year → 0.0333×(30/365) = 0.002737 ETH/month
    return {
      citizenPerMonth: 0.000912,
      teamPerMonth: 0.002737,
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

    // Both windows share the same memoised Etherscan fetch — no extra API calls.
    const [trailing30d, trailing365d] = await Promise.all([
      getCanonicalSubscriptionRevenue(trailing30dStart,  now, ethPrice),
      getCanonicalSubscriptionRevenue(trailing365dStart, now, ethPrice),
    ])

    // Monthly cost for ALL baseline subscribers at current on-chain prices
    const monthlySubscriptionCostETH =
      BASELINE.citizens * prices.citizenPerMonth +
      BASELINE.teams * prices.teamPerMonth

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
