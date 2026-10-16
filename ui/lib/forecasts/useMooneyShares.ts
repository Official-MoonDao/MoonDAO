import { useEffect, useState } from 'react'
import { votingPowerByOutcome } from './aggregate'
import { consensusQuery } from './consensusQuery'
import type { ForecastConsensus } from './consensusTypes'
import { subscribeRoster } from './rosterRefresh'

/**
 * Each outcome's share of Citizen voting power, in percent (outcome-index order).
 * Empty when nobody with voting power has predicted yet; null until loaded.
 */
export function useMooneyShares(args: {
  chainSlug?: string
  deprizeId?: number
  numOutcomes: number
}): { shares: number[] | null; loading: boolean } {
  const { chainSlug, deprizeId, numOutcomes } = args
  const [shares, setShares] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    return subscribeRoster((notice) => {
      if (notice.chain === chainSlug && notice.deprizeId === deprizeId) {
        setRefreshNonce((n) => n + 1)
      }
    })
  }, [chainSlug, deprizeId])

  useEffect(() => {
    if (chainSlug == null || deprizeId == null || numOutcomes < 2) return
    let cancelled = false
    setLoading(true)
    void fetch(
      consensusQuery({
        chain: chainSlug,
        deprizeId,
        outcomes: numOutcomes,
        ...(refreshNonce > 0 ? { fresh: true } : {}),
      })
    )
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const body = (await res.json()) as ForecastConsensus
        if (cancelled) return
        const powers = votingPowerByOutcome(body.leaderboard ?? [], numOutcomes)
        const total = powers.reduce((sum, value) => sum + value, 0)
        setShares(total > 0 ? powers.map((value) => (value / total) * 100) : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chainSlug, deprizeId, numOutcomes, refreshNonce])

  return { shares, loading }
}
