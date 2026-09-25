import { useEffect, useMemo, useState } from 'react'
import { useCitizenRowsByOwners } from '@/lib/citizen/useCitizenRowsByOwners'
import { citizenFromCaller } from '@/lib/forecasts/callerIdentity'
import { consensusQuery } from '@/lib/forecasts/consensusQuery'
import type { ForecastCaller, ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import {
  leadingPickLabel,
  mergeCallerRoster,
  pruneRosterOverlays,
  readRosterNeedsFresh,
  subscribeRoster,
  type RosterOverlay,
} from '@/lib/forecasts/rosterRefresh'
import { SCROLL_LIST } from '@/components/deprize/detail/primitives'
import CitizenIdentity from '@/components/layout/CitizenIdentity'

/** `/api/voting-power` takes at most 100 addresses per call. */
const MAX_ADDRESSES = 100

type CallerRow = {
  address: string
  /** Label of the outcome they predicted, when they wrote one. */
  pick?: string
  bet: boolean
  votingPower: number
}

function formatVotingPower(vp: number): string {
  if (!Number.isFinite(vp) || vp <= 0) return '0'
  return vp.toLocaleString(undefined, { maximumFractionDigits: vp < 10 ? 1 : 0 })
}

/**
 * Who predicted this prize, ranked by voting power rather than ETH. Citizens who
 * wrote a prediction and wallets that placed an ETH bet both belong here.
 */
export default function DePrizeCallers(props: {
  chainSlug: string
  deprizeId?: number
  labels: string[]
  bettorAddresses: readonly string[]
}) {
  return <DePrizeCallersList key={`${props.chainSlug}:${props.deprizeId ?? ''}`} {...props} />
}

function DePrizeCallersList(props: {
  chainSlug: string
  deprizeId?: number
  labels: string[]
  bettorAddresses: readonly string[]
}) {
  const { chainSlug, deprizeId, labels, bettorAddresses } = props
  const outcomes = labels.length
  const [leaderboard, setLeaderboard] = useState<ForecastCaller[]>([])
  const [overlays, setOverlays] = useState<RosterOverlay[]>([])
  const [votingPowers, setVotingPowers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [noticeFresh, setNoticeFresh] = useState(false)
  const [rosterTick, setRosterTick] = useState(0)

  const sessionFresh = deprizeId != null && readRosterNeedsFresh(chainSlug, deprizeId)
  const needsFresh = sessionFresh || noticeFresh
  const labelKey = JSON.stringify(labels)

  const bettorKey = useMemo(
    () => [...new Set(bettorAddresses.map((address) => address.toLowerCase()))].sort().join(','),
    [bettorAddresses]
  )

  useEffect(() => {
    if (deprizeId == null) return
    return subscribeRoster((notice) => {
      if (notice.chain !== chainSlug || notice.deprizeId !== deprizeId) return
      const address = notice.address.toLowerCase()
      setOverlays((prev) => [
        ...prev.filter((row) => row.address.toLowerCase() !== address),
        { address, pick: notice.pick, removed: notice.removed },
      ])
      setNoticeFresh(true)
      setRosterTick((tick) => tick + 1)
    })
  }, [chainSlug, deprizeId])

  useEffect(() => {
    let cancelled = false
    const labelList = JSON.parse(labelKey) as string[]
    async function load() {
      if (deprizeId == null || outcomes < 2) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        // First paint uses the shared non-fresh URL unless this prize was just
        // written. needsFresh busts s-maxage after a roster notice or a recent save.
        const res = await fetch(
          consensusQuery({
            chain: chainSlug,
            deprizeId,
            outcomes,
            fresh: needsFresh,
          })
        )
        if (!res.ok || cancelled) return
        const body = (await res.json()) as ForecastConsensus
        if (cancelled) return
        const server = body.leaderboard ?? []
        setLeaderboard(server)
        setOverlays((prev) => pruneRosterOverlays(prev, server, labelList))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [chainSlug, deprizeId, outcomes, needsFresh, rosterTick, labelKey])

  const merged = useMemo(
    () => mergeCallerRoster(leaderboard, overlays, JSON.parse(labelKey) as string[]),
    [labelKey, leaderboard, overlays]
  )

  const addresses = useMemo(() => {
    const seen = new Set<string>()
    for (const row of merged) seen.add(row.voterAddress.toLowerCase())
    // A cleared forecast drops that row. An ETH position on the same wallet stays.
    for (const address of bettorKey ? bettorKey.split(',') : []) {
      seen.add(address)
    }
    return [...seen].slice(0, MAX_ADDRESSES)
  }, [bettorKey, merged])

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

  const callerByAddress = useMemo(() => {
    const map = new Map<string, ForecastCaller>()
    for (const row of merged) map.set(row.voterAddress.toLowerCase(), row)
    return map
  }, [merged])

  const overlayPick = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of overlays) {
      if (!row.removed && row.pick) map.set(row.address.toLowerCase(), row.pick)
    }
    return map
  }, [overlays])

  const rows = useMemo<CallerRow[]>(() => {
    const bettors = new Set(bettorKey ? bettorKey.split(',') : [])
    const pickByAddress = new Map<string, string | undefined>()
    for (const row of merged) {
      const address = row.voterAddress.toLowerCase()
      pickByAddress.set(
        address,
        overlayPick.get(address) ?? leadingPickLabel(row.allocation, labels)
      )
    }
    return addresses
      .map((address) => ({
        address,
        pick: pickByAddress.get(address),
        bet: bettors.has(address),
        votingPower: votingPowers[address] ?? 0,
      }))
      .sort((a, b) => b.votingPower - a.votingPower || a.address.localeCompare(b.address))
  }, [addresses, bettorKey, labels, merged, overlayPick, votingPowers])

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
        <h3 className="text-[15px] font-semibold text-white">{FORECAST_COPY.callersHeading}</h3>
        <p className="text-gray-400 text-sm">{FORECAST_COPY.callersEmpty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-white">{FORECAST_COPY.callersHeading}</h3>
        <p className="text-xs text-[#8b93a7]">{FORECAST_COPY.callersCount(rows.length)}</p>
      </div>
      <ul className={`space-y-1.5 ${SCROLL_LIST}`}>
        {rows.map((row) => {
          const owner = citizens.get(row.address)
          const consensusCitizen = owner
            ? undefined
            : citizenFromCaller(callerByAddress.get(row.address))
          return (
            <li
              key={row.address}
              className="flex items-center justify-between gap-2 sm:gap-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <CitizenIdentity
                  address={row.address}
                  citizen={owner ?? consensusCitizen?.citizen}
                  fallbackName={owner ? undefined : consensusCitizen?.fallbackName}
                />
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {row.pick ? row.pick : FORECAST_COPY.backedWithEth}
                  {row.pick && row.bet ? ' · ETH bet' : ''}
                </span>
              </span>
              <span
                className="shrink-0 text-[15px] font-semibold tabular-nums text-white"
                title={FORECAST_COPY.votingPower}
              >
                {formatVotingPower(row.votingPower)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
