import { DEPRIZE_MINT_ADDRESSES } from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import type { Chain } from 'thirdweb'
import { fetchDePrizeBets, fetchMarketTrades, sellsFromTrades, type TradeRow } from './activity-fetch'
import { totalStaked, uniqueBackers, type BetRow, type SellRow } from './activity-math'
import type { FundingLike } from './lmsr-history'
import { getChainSlug } from '@/lib/thirdweb/chain'

export type DePrizeActivity = {
  bets: BetRow[]
  sells: SellRow[]
  trades: TradeRow[]
  fundingChanges: FundingLike[]
  backers: number
  totalStakedEth: number
  loading: boolean
  error: string | undefined
}

const EMPTY: Omit<DePrizeActivity, 'loading' | 'error'> = {
  bets: [],
  sells: [],
  trades: [],
  fundingChanges: [],
  backers: 0,
  totalStakedEth: 0,
}

/**
 * On-chain activity for one DePrize: every `Bet` (who backed what, for how
 * much) and every LMSR trade (price moves, cash-outs). Re-fetches when
 * `refreshNonce` changes; the underlying fetches are session-cached so the
 * market hook's odds rebuild shares the same requests.
 */
export function useDePrizeActivity(args: {
  deprizeId: number | undefined
  marketAddress: string | undefined
  chain: Chain
  refreshNonce?: number
}): DePrizeActivity {
  const { deprizeId, marketAddress, chain, refreshNonce = 0 } = args
  const chainSlug = getChainSlug(chain)
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug]
  const [data, setData] = useState<Omit<DePrizeActivity, 'loading' | 'error'>>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (deprizeId === undefined || !marketAddress || /^0x0+$/.test(marketAddress)) {
      setData(EMPTY)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(undefined)
    ;(async () => {
      try {
        const bets = await fetchDePrizeBets({ chain, chainSlug, deprizeId, gen: refreshNonce })
        if (cancelled) return
        const firstBetBlock = bets.length ? bets[0].blockNumber : undefined
        const { trades, fundingChanges } = firstBetBlock
          ? await fetchMarketTrades({
              chain,
              marketAddress,
              fromBlock: firstBetBlock,
              gen: refreshNonce,
            })
          : { trades: [] as TradeRow[], fundingChanges: [] as FundingLike[] }
        if (cancelled) return
        setData({
          bets,
          sells: sellsFromTrades(trades, mintAddress),
          trades,
          fundingChanges,
          backers: uniqueBackers(bets),
          totalStakedEth: totalStaked(bets),
        })
      } catch (e: any) {
        if (cancelled) return
        console.warn('[deprize] activity load failed', e)
        setError(e?.shortMessage || e?.message || 'Failed to load activity')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deprizeId, marketAddress, chain, chainSlug, mintAddress, refreshNonce])

  return useMemo(() => ({ ...data, loading, error }), [data, loading, error])
}
