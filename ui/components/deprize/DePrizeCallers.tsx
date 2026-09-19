import { useEffect, useMemo, useState } from 'react'
import { useCitizenRowsByOwners } from '@/lib/citizen/useCitizenRowsByOwners'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import CitizenIdentity from '@/components/layout/CitizenIdentity'

/** `/api/voting-power` takes at most 100 addresses per call. */
const MAX_ADDRESSES = 100

type CallerRow = {
  address: string
  /** Label of the outcome they called, when they wrote a prediction. */
  pick?: string
  bet: boolean
  votingPower: number
}

function formatVotingPower(vp: number): string {
  if (!Number.isFinite(vp) || vp <= 0) return '0'
  return vp.toLocaleString(undefined, { maximumFractionDigits: vp < 10 ? 1 : 0 })
}

/**
 * Who called this prize, ranked by voting power rather than ETH. Citizens who
 * wrote a prediction and wallets that placed an ETH bet both belong here — the
 * bet is a call too, it just costs money instead of vMOONEY.
 */
export default function DePrizeCallers(props: {
  chainSlug: string
  deprizeId?: number
  labels: string[]
  bettorAddresses: readonly string[]
  refreshNonce?: number
}) {
  const { chainSlug, deprizeId, labels, bettorAddresses, refreshNonce = 0 } = props
  const outcomes = labels.length
  const [leaderboard, setLeaderboard] = useState<ForecastConsensus['leaderboard']>([])
  const [votingPowers, setVotingPowers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const bettorKey = useMemo(
    () => [...new Set(bettorAddresses.map((address) => address.toLowerCase()))].sort().join(','),
    [bettorAddresses]
  )

  useEffect(() => {
    setLeaderboard([])
  }, [chainSlug, deprizeId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (deprizeId == null || outcomes < 2) {
        setLeaderboard([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        // Same query string the competitors panel uses, so the two share one
        // CDN entry instead of warming two. `gen` only after a write so the
        // first paint still hits that shared entry.
        const qs = new URLSearchParams({
          chain: chainSlug,
          deprizeId: String(deprizeId),
          outcomes: String(outcomes),
        })
        if (refreshNonce) qs.set('gen', String(refreshNonce))
        const res = await fetch(`/api/forecasts/consensus?${qs}`)
        if (!res.ok || cancelled) return
        const body = (await res.json()) as ForecastConsensus
        if (cancelled) return
        setLeaderboard(body.leaderboard ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [chainSlug, deprizeId, outcomes, refreshNonce])

  const addresses = useMemo(() => {
    const seen = new Set<string>()
    for (const row of leaderboard) seen.add(row.voterAddress.toLowerCase())
    for (const address of bettorKey ? bettorKey.split(',') : []) seen.add(address)
    return [...seen].slice(0, MAX_ADDRESSES)
  }, [leaderboard, bettorKey])

  const addressKey = addresses.join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!addressKey) return
      try {
        const res = await fetch(`/api/voting-power?addresses=${addressKey}`)
        if (!res.ok || cancelled) return
        const body = (await res.json()) as { votingPowers?: number[] }
        if (cancelled || !Array.isArray(body.votingPowers)) return
        const list = addressKey.split(',')
        const next: Record<string, number> = {}
        list.forEach((address, i) => {
          const value = body.votingPowers?.[i]
          next[address] = Number.isFinite(value) ? (value as number) : 0
        })
        setVotingPowers(next)
      } catch {
        // Voting power is decoration here; the roster still renders without it.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [addressKey])

  const citizens = useCitizenRowsByOwners(addresses, chainSlug)

  const rows = useMemo<CallerRow[]>(() => {
    const bettors = new Set(bettorKey ? bettorKey.split(',') : [])
    const pickByAddress = new Map<string, string | undefined>()
    for (const row of leaderboard) {
      let best = -1
      row.allocation.forEach((value, i) => {
        if (value > 0 && (best < 0 || value > (row.allocation[best] ?? 0))) best = i
      })
      pickByAddress.set(row.voterAddress.toLowerCase(), best >= 0 ? labels[best] : undefined)
    }
    return addresses
      .map((address) => ({
        address,
        pick: pickByAddress.get(address),
        bet: bettors.has(address),
        votingPower: votingPowers[address] ?? 0,
      }))
      .sort((a, b) => b.votingPower - a.votingPower || a.address.localeCompare(b.address))
  }, [addresses, bettorKey, labels, leaderboard, votingPowers])

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-5/6 rounded bg-white/5" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-white text-sm font-semibold">Who&apos;s called it</h3>
        <p className="text-gray-400 text-sm">Nobody has called this one yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-white text-sm font-semibold">Who&apos;s called it</h3>
        <p className="text-gray-400 text-xs">
          {rows.length} {rows.length === 1 ? 'caller' : 'callers'}
        </p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.address} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <CitizenIdentity address={row.address} citizen={citizens.get(row.address)} />
              <span className="mt-0.5 block truncate text-xs text-gray-500">
                {row.pick ? row.pick : 'Backed with ETH'}
                {row.pick && row.bet ? ' · ETH bet' : ''}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-gray-300" title="Voting power (√vMOONEY)">
              {formatVotingPower(row.votingPower)} VP
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
