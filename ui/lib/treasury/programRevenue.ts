/**
 * Program revenue that lands in the Arbitrum treasury as ETH.
 *
 * Subscriptions already have a canonical helper. Launchpad and DePrize fees
 * arrive the same way — a contract calls the treasury Safe — so rather than
 * decoding each product's events we classify the treasury's internal-transaction
 * list by sender. That keeps every ETH stream on one methodology, and it means a
 * program whose payout route changes shows up as an unclassified inflow instead
 * of silently reading zero.
 *
 * Deliberately NOT counted as revenue here:
 *   - FeeHook (Uniswap v4) pool fees. `fee-hook/src/FeeHook.sol#distributeFees`
 *     pays checked-in vMOONEY holders directly; the treasury never receives it.
 *   - The DePrize 5% bet slice. `DePrizeMint.bet` routes it to the Juicebox
 *     prize pool with the bettor as beneficiary — it funds the prize, not us.
 *   - The Launchpad 5% pool-deployer slice and 17.5% mission-token vesting.
 *     Both are MoonDAO-controlled value, but they are assets acquired, not cash
 *     earned, and the token side is unvested.
 */
import {
  CITIZEN_ADDRESSES,
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  JBV4_TERMINAL_ADDRESSES,
  JBV5_TERMINAL_ADDRESS,
  MOONDAO_ARBITRUM_TREASURY,
  MOONDAO_L2_TREASURY,
  MOONDAO_POLYGON_TREASURY,
  MOONDAO_TREASURY,
  TEAM_ADDRESSES,
} from 'const/config'
import { fetchTreasuryInternalTxs } from './canonicalRevenue'

/** Share of a successful mission's payout that is split to the treasury. */
export const LAUNCHPAD_TREASURY_FEE_RATE = 0.025

export type StreamKey = 'citizen' | 'team' | 'launchpad' | 'deprize'

export interface InflowTx {
  from: string
  timestamp: number
  valueETH: number
  hash: string
}

export interface InflowBucket {
  totalETH: number
  txCount: number
}

export interface UnclassifiedSource {
  address: string
  totalETH: number
  txCount: number
}

export interface ClassifiedInflows {
  buckets: Record<StreamKey, InflowBucket>
  /** Moves between MoonDAO's own Safes. Value relocated, not earned. */
  internalTransfers: InflowBucket
  /**
   * Contract-routed ETH we can't attribute to a known program. Reported as a
   * diagnostic, never added to revenue: an inflow can just as easily be a
   * refund, a returned project budget, or a bridge as it can be income.
   */
  unclassified: InflowBucket & { topSources: UnclassifiedSource[] }
}

export interface ProgramSourceConfig {
  citizen: string[]
  team: string[]
  launchpad: string[]
  deprize: string[]
  /** MoonDAO-owned addresses whose transfers are relocations, not revenue. */
  internal: string[]
}

function lc(values: (string | undefined | null)[]): string[] {
  return values.filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase())
}

/**
 * Bucket treasury inflows by sender. Pure so the attribution rules can be
 * tested without touching Etherscan.
 */
export function classifyTreasuryInflows(
  txs: InflowTx[],
  sources: ProgramSourceConfig,
  maxUnclassifiedSources = 5
): ClassifiedInflows {
  const lookup: [StreamKey, Set<string>][] = [
    ['citizen', new Set(lc(sources.citizen))],
    ['team', new Set(lc(sources.team))],
    ['launchpad', new Set(lc(sources.launchpad))],
    ['deprize', new Set(lc(sources.deprize))],
  ]
  const internal = new Set(lc(sources.internal))

  const buckets: Record<StreamKey, InflowBucket> = {
    citizen: { totalETH: 0, txCount: 0 },
    team: { totalETH: 0, txCount: 0 },
    launchpad: { totalETH: 0, txCount: 0 },
    deprize: { totalETH: 0, txCount: 0 },
  }
  const internalTransfers: InflowBucket = { totalETH: 0, txCount: 0 }
  const unclassifiedBySource = new Map<string, UnclassifiedSource>()
  let unclassifiedETH = 0
  let unclassifiedCount = 0

  for (const tx of txs) {
    if (!(tx.valueETH > 0)) continue
    const from = tx.from?.toLowerCase()
    if (!from) continue

    const match = lookup.find(([, set]) => set.has(from))
    if (match) {
      const bucket = buckets[match[0]]
      bucket.totalETH += tx.valueETH
      bucket.txCount += 1
      continue
    }

    if (internal.has(from)) {
      internalTransfers.totalETH += tx.valueETH
      internalTransfers.txCount += 1
      continue
    }

    unclassifiedETH += tx.valueETH
    unclassifiedCount += 1
    const existing = unclassifiedBySource.get(from)
    if (existing) {
      existing.totalETH += tx.valueETH
      existing.txCount += 1
    } else {
      unclassifiedBySource.set(from, { address: from, totalETH: tx.valueETH, txCount: 1 })
    }
  }

  const topSources = Array.from(unclassifiedBySource.values())
    .sort((a, b) => b.totalETH - a.totalETH)
    .slice(0, maxUnclassifiedSources)

  return {
    buckets,
    internalTransfers,
    unclassified: { totalETH: unclassifiedETH, txCount: unclassifiedCount, topSources },
  }
}

/**
 * Addresses that route each program's ETH into the Arbitrum treasury.
 *
 * Launchpad: mission payouts are split on `sendPayoutsOf`, so the ETH arrives
 * from the Juicebox terminal rather than from any MoonDAO contract.
 * DePrize: `DePrizeFeeRouter` forwards swept LMSR fees to its owner once the
 * competition is terminal. It has no mainnet deployment yet, so on Arbitrum
 * this list is empty and the stream reports as unavailable rather than $0.
 */
export function getArbitrumProgramSources(): ProgramSourceConfig {
  return {
    citizen: [CITIZEN_ADDRESSES['arbitrum']],
    team: [TEAM_ADDRESSES['arbitrum']],
    launchpad: [JBV5_TERMINAL_ADDRESS, JBV4_TERMINAL_ADDRESSES['arbitrum']],
    deprize: [DEPRIZE_FEE_ROUTER_ADDRESSES['arbitrum']],
    internal: [
      MOONDAO_TREASURY,
      MOONDAO_ARBITRUM_TREASURY,
      MOONDAO_L2_TREASURY,
      MOONDAO_POLYGON_TREASURY,
      '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354', // Base treasury
      '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4', // Optimism treasury
      '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537', // Multichain routing
    ],
  }
}

export interface ProgramRevenueResult {
  startMs: number
  endMs: number
  ethPriceUSD: number
  launchpad: InflowBucket & { totalUSD: number; available: boolean; note: string }
  deprize: InflowBucket & { totalUSD: number; available: boolean; note: string }
  unclassified: {
    totalETH: number
    totalUSD: number
    txCount: number
    topSources: (UnclassifiedSource & { totalUSD: number })[]
    note: string
  }
  internalTransfersETH: number
  source: string
}

/**
 * Launchpad and DePrize ETH received by the Arbitrum treasury in a window,
 * plus the unattributed remainder.
 */
export async function getProgramRevenue(
  startMs: number,
  endMs: number,
  ethPriceUSD: number
): Promise<ProgramRevenueResult> {
  const txs = await fetchTreasuryInternalTxs()
  const treasury = MOONDAO_ARBITRUM_TREASURY.toLowerCase()

  const inflows: InflowTx[] = txs
    .filter((t) => t.to?.toLowerCase() === treasury && t.isError === '0')
    .map((t) => ({
      from: t.from,
      timestamp: parseInt(t.timeStamp, 10) * 1000,
      valueETH: Number(t.value) / 1e18,
      hash: t.hash,
    }))
    .filter((t) => t.timestamp >= startMs && t.timestamp <= endMs)

  const sources = getArbitrumProgramSources()
  const classified = classifyTreasuryInflows(inflows, sources)

  const launchpadConfigured = sources.launchpad.some(Boolean)
  const deprizeConfigured = sources.deprize.some(Boolean)

  return {
    startMs,
    endMs,
    ethPriceUSD,
    launchpad: {
      ...classified.buckets.launchpad,
      totalUSD: classified.buckets.launchpad.totalETH * ethPriceUSD,
      available: launchpadConfigured,
      note: launchpadConfigured
        ? `${(LAUNCHPAD_TREASURY_FEE_RATE * 100).toFixed(
            1
          )}% of each successful mission payout, split to the treasury when the mission owner sends payouts.`
        : 'No Juicebox terminal configured for this chain.',
    },
    deprize: {
      ...classified.buckets.deprize,
      totalUSD: classified.buckets.deprize.totalETH * ethPriceUSD,
      available: deprizeConfigured,
      note: deprizeConfigured
        ? '1% LMSR trade fee, swept to the treasury once a competition is terminal.'
        : 'DePrize is testnet-only — no mainnet fee router deployed, so there is nothing to earn yet.',
    },
    unclassified: {
      totalETH: classified.unclassified.totalETH,
      totalUSD: classified.unclassified.totalETH * ethPriceUSD,
      txCount: classified.unclassified.txCount,
      topSources: classified.unclassified.topSources.map((s) => ({
        ...s,
        totalUSD: s.totalETH * ethPriceUSD,
      })),
      note: 'Contract-routed ETH into the Arbitrum treasury from an unrecognised sender. Not counted as revenue — could be a refund, a returned project budget, or a bridge. Listed so a new revenue route is visible instead of missing.',
    },
    internalTransfersETH: classified.internalTransfers.totalETH,
    source:
      'https://api.etherscan.io/v2/api?chainid=42161&module=account&action=txlistinternal&address=' +
      MOONDAO_ARBITRUM_TREASURY,
  }
}
