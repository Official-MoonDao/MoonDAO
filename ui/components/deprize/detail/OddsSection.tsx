import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { votingPowerByOutcome } from '@/lib/forecasts/aggregate'
import { consensusQuery } from '@/lib/forecasts/consensusQuery'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { CARD } from './primitives'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

type OddsSource = 'eth' | 'mooney'

export default function OddsSection(props: {
  numOutcomes: number
  question?: string
  activityLoading: boolean
  activityError?: unknown
  betsLength: number
  history: any
  labels: string[]
  colors: string[]
  domainStartMs?: number
  markers: any
  oddsLoading: boolean
  chainSlug?: string
  deprizeId?: number
  onSourceChange?: (source: 'eth' | 'mooney') => void
}) {
  const [source, setSource] = useState<OddsSource>('eth')
  const [mooney, setMooney] = useState<number[] | null>(null)
  const [mooneyLoading, setMooneyLoading] = useState(false)

  useEffect(() => {
    if (props.chainSlug == null || props.deprizeId == null || props.numOutcomes < 2) return
    let cancelled = false
    setMooneyLoading(true)
    void fetch(
      consensusQuery({
        chain: props.chainSlug,
        deprizeId: props.deprizeId,
        outcomes: props.numOutcomes,
      })
    )
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const body = (await res.json()) as ForecastConsensus
        if (cancelled) return
        const powers = votingPowerByOutcome(body.leaderboard ?? [], props.numOutcomes)
        const total = powers.reduce((sum, value) => sum + value, 0)
        setMooney(total > 0 ? powers.map((value) => (value / total) * 100) : [])
      })
      .finally(() => {
        if (!cancelled) setMooneyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [props.chainSlug, props.deprizeId, props.numOutcomes])

  const mooneyHistory = useMemo(() => {
    if (!mooney || mooney.length === 0) return []
    const t = props.domainStartMs ?? Date.now()
    return [{ t, p: mooney }]
  }, [mooney, props.domainStartMs])

  if (props.numOutcomes <= 0) return null

  const ethEmpty = !props.activityLoading && !props.activityError && props.betsLength === 0

  return (
    <div className={CARD}>
      {props.question && (
        <p className="text-white text-base font-semibold leading-snug">{props.question}</p>
      )}
      <div className={`mb-3 flex items-center justify-between gap-3 ${props.question ? 'mt-1' : ''}`}>
        <p className="text-xs font-normal text-gray-500">
          {source === 'eth'
            ? ethEmpty
              ? 'Starting odds — no bets yet'
              : 'Odds'
            : 'Citizen voting power'}
        </p>
        <div className="flex rounded-lg bg-black/30 p-0.5 text-xs font-semibold">
          <button
            type="button"
            aria-pressed={source === 'eth'}
            onClick={() => {
              setSource('eth')
              props.onSourceChange?.('eth')
            }}
            className={`rounded-md px-2.5 py-1 ${
              source === 'eth' ? 'bg-white text-slate-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            ETH
          </button>
          <button
            type="button"
            aria-pressed={source === 'mooney'}
            onClick={() => {
              setSource('mooney')
              props.onSourceChange?.('mooney')
            }}
            className={`rounded-md px-2.5 py-1 ${
              source === 'mooney' ? 'bg-white text-slate-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            MOONEY
          </button>
        </div>
      </div>
      {source === 'eth' ? (
        <OddsHistoryChart
          history={props.history}
          labels={props.labels}
          colors={props.colors}
          domainStartMs={props.domainStartMs}
          markers={props.markers}
          loading={props.oddsLoading}
        />
      ) : mooney && mooney.length > 0 ? (
        <>
          <OddsHistoryChart
            history={mooneyHistory}
            labels={props.labels}
            colors={props.colors}
            domainStartMs={props.domainStartMs}
            loading={mooneyLoading}
          />
          <p className="mt-2 text-[11px] leading-snug text-gray-500">
            Current voting-power share. A vote with 0 voting power is saved and does not move this.
          </p>
        </>
      ) : (
        <div className="flex h-[220px] items-center justify-center px-4 text-center text-xs text-gray-500">
          {mooneyLoading
            ? 'Loading MOONEY votes…'
            : 'No MOONEY votes yet. A prediction without a Citizen is saved at 0 voting power and does not move this chart.'}
        </div>
      )}
    </div>
  )
}
