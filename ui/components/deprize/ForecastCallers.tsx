import { useEffect, useState } from 'react'
import { CARD } from '@/components/deprize/detail/primitives'
import type { ForecastCaller, ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_DAO_MIN_PARTICIPANTS } from '@/lib/forecasts/constants'

export default function ForecastCallers({
  chainSlug,
  deprizeId,
  labels,
  resolvedVector,
}: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  resolvedVector?: number[] | null
}) {
  const [rows, setRows] = useState<ForecastCaller[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [participants, setParticipants] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const qs = new URLSearchParams({
        chain: chainSlug,
        deprizeId: String(deprizeId),
        outcomes: String(labels.length),
      })
      if (resolvedVector && resolvedVector.length === labels.length) {
        qs.set('resolved', JSON.stringify(resolvedVector))
      }
      try {
        const res = await fetch(`/api/forecasts/consensus?${qs}`)
        if (!res.ok) return
        const body = (await res.json()) as ForecastConsensus
        if (cancelled) return
        setRows(body.leaderboard ?? [])
        setParticipants(body.participants ?? 0)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [chainSlug, deprizeId, labels.length, resolvedVector])

  return (
    <section className={CARD}>
      <h3 className="text-white text-sm font-semibold">Who&apos;s called it</h3>
      {isLoading && <p className="mt-2 text-sm text-gray-400">Loading predictions…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-2 text-sm text-gray-400">No Citizen predictions yet.</p>
      )}
      {participants > 0 && participants < FORECAST_DAO_MIN_PARTICIPANTS && (
        <p className="mt-2 text-xs text-gray-400">
          {participants} of {FORECAST_DAO_MIN_PARTICIPANTS} Citizens needed to reveal the DAO number.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.voterAddress} className="text-sm">
              <p className="text-white truncate">{row.citizenName}</p>
              <p className="text-xs text-gray-400">
                {labels
                  .map((label, idx) => `${label} ${Math.round(row.allocation[idx] ?? 0)}%`)
                  .join(' · ')}
                {row.skill != null ? ` · Skill ${row.skill.toFixed(2)}` : ''}
                {row.brier != null ? ` · Brier ${row.brier.toFixed(2)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
