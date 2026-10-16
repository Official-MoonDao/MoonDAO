// Odds chart for the one market in the active hero slide. Mount it only for
// the visible slide: the trade history behind it is a log scan per market.
//
// The index mounts every live market at once, and their reads share one
// throttled queue. Rebuilding the chart only needs the market address, its
// funding and its start time, so this reads those three on the priority lane
// instead of waiting behind every card's prices and balances.
import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import { DEPRIZE_MINT_ADDRESSES } from 'const/config'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { fetchDePrizeBets } from '@/lib/deprize/activity-fetch'
import { UNIT } from '@/lib/deprize/constants'
import type { OddsSample } from '@/lib/deprize/odds-chart'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { useDePrizeActivity } from '@/lib/deprize/useDePrizeActivity'
import type { UseDePrizeMarketResult } from '@/lib/deprize/useDePrizeMarket'
import { useOddsHistory } from '@/lib/deprize/useOddsHistory'
import { getChainSlug } from '@/lib/thirdweb/chain'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})

const HEIGHT = 240
const CACHE_VERSION = 'v1'

function ChartSkeleton() {
  return (
    <div
      aria-label="Loading odds"
      className="animate-pulse rounded-xl bg-white/[0.03]"
      style={{ height: HEIGHT }}
    />
  )
}

type Basics = { marketAddress?: string; fundingEth?: number; marketStartMs?: number }

function useMarketBasics(chain: Chain, deprizeId: number | undefined): Basics {
  const [basics, setBasics] = useState<Basics>({})
  useEffect(() => {
    setBasics({})
    const mintAddress = DEPRIZE_MINT_ADDRESSES[getChainSlug(chain)]
    if (deprizeId === undefined || !mintAddress) return
    let cancelled = false
    const readChain = deprizeReadChain(chain.id)
    ;(async () => {
      try {
        const mint = getContract({
          client: deprizeReadClient,
          chain: readChain,
          address: mintAddress,
          abi: DePrizeMintABI as any,
        })
        const market = await rpcRead<string>(
          { contract: mint, method: 'marketOf' as string, params: [BigInt(deprizeId)] },
          { priority: true }
        )
        if (cancelled || !market || /^0x0+$/.test(market)) return
        setBasics({ marketAddress: market })
        const lmsr = getContract({
          client: deprizeReadClient,
          chain: readChain,
          address: market,
          abi: LMSRWithTWAP.abi as any,
        })
        const [funding, start] = await Promise.all([
          rpcRead<bigint>(
            { contract: lmsr, method: 'funding' as string, params: [] },
            { priority: true }
          ).catch(() => undefined),
          rpcRead<bigint>(
            { contract: lmsr, method: 'startTime' as string, params: [] },
            { priority: true }
          ).catch(() => 0n),
        ])
        if (cancelled) return
        const startSec = Number(start)
        setBasics({
          marketAddress: market,
          fundingEth: funding !== undefined ? Number(funding) / Number(UNIT) : undefined,
          marketStartMs: startSec > 0 ? startSec * 1000 : undefined,
        })
      } catch {
        /* the market hook's own reads still fill these in */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chain, deprizeId])
  return basics
}

export default function HeroOddsChart({
  deprizeId,
  market,
  chain,
  labels,
  colors,
  refreshNonce = 0,
}: {
  deprizeId: number | undefined
  market: UseDePrizeMarketResult
  chain: Chain
  /** Outcome-index order, same as `market.outcomes`. */
  labels: string[]
  colors: string[]
  refreshNonce?: number
}) {
  const chainSlug = getChainSlug(chain)

  // Bets only need the prize id, so start that log fetch now; the activity
  // hook below picks up the same cached request once the market resolves.
  useEffect(() => {
    if (deprizeId === undefined) return
    fetchDePrizeBets({ chain, chainSlug, deprizeId, gen: refreshNonce }).catch(() => {})
  }, [chain, chainSlug, deprizeId, refreshNonce])

  const basics = useMarketBasics(chain, deprizeId)
  const fastMarket = useMemo<UseDePrizeMarketResult>(
    () => ({
      ...market,
      marketAddress: market.marketAddress ?? basics.marketAddress,
      fundingEth: market.fundingEth ?? basics.fundingEth,
      marketStartMs: market.marketStartMs ?? basics.marketStartMs,
      outcomes: market.outcomes.length
        ? market.outcomes
        : labels.map((_, index) => ({ index, probability: NaN, balance: NaN, positionId: 0n })),
    }),
    [market, basics, labels]
  )

  const activity = useDePrizeActivity({
    deprizeId,
    marketAddress: fastMarket.marketAddress,
    chain,
    refreshNonce,
  })
  const odds = useOddsHistory({ market: fastMarket, activity })

  // No trades means LMSR prices have not moved since the market opened, so a
  // flat line at today's prices is the true history, not filler.
  const fresh = useMemo<OddsSample[]>(() => {
    if (odds.history.length === 1) {
      const only = odds.history[0]
      return [only, { t: Math.max(Date.now(), only.t + 60_000), p: only.p }]
    }
    if (odds.history.length || odds.loading) return odds.history
    const live = market.outcomes.map((o) => o.probability)
    if (!live.length || !live.every((p) => Number.isFinite(p))) return []
    const now = Date.now()
    const start = fastMarket.marketStartMs ?? now - 24 * 60 * 60 * 1000
    return [
      { t: Math.min(start, now - 60_000), p: live },
      { t: now, p: live },
    ]
  }, [odds.history, odds.loading, market.outcomes, fastMarket.marketStartMs])

  // Last chart drawn for this prize, shown at once on the next visit while
  // the fresh one rebuilds.
  const cacheKey =
    deprizeId !== undefined ? `deprize:heroOdds:${CACHE_VERSION}:${chain.id}:${deprizeId}` : null
  const [cached, setCached] = useState<OddsSample[]>([])
  useEffect(() => {
    setCached([])
    if (!cacheKey) return
    try {
      const raw = window.localStorage.getItem(cacheKey)
      const parsed = raw ? (JSON.parse(raw) as OddsSample[]) : []
      if (Array.isArray(parsed) && parsed.every((s) => s.p?.length === labels.length)) {
        setCached(parsed)
      }
    } catch {
      /* private mode / bad entry */
    }
  }, [cacheKey, labels.length])
  useEffect(() => {
    if (!cacheKey || fresh.length < 2) return
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(fresh))
    } catch {
      /* quota / private mode */
    }
  }, [cacheKey, fresh])

  const history = fresh.length >= 2 ? fresh : cached
  // Once the market has answered and there is still nothing to plot, let the
  // chart say so rather than pulsing forever.
  const settled = !odds.loading && market.stage !== undefined
  if (history.length < 2 && !settled) return <ChartSkeleton />

  return (
    <OddsHistoryChart
      variant="hero"
      history={history}
      labels={labels}
      colors={colors}
      height={HEIGHT}
      domainStartMs={fastMarket.marketStartMs}
    />
  )
}
