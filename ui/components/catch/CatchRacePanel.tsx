/**
 * "The real race" panel on the Catch result screen.
 *
 * Catching a Starship is a step toward landing one on the Moon, so this panel
 * shows where Starship HLS stands in the race to be the next upright lunar
 * landing: its odds beside the two front-runners.
 *
 * Read-only, and the same goal-odds bridge the Touchdown panel uses: live
 * market odds when the market is live, otherwise the atlas forecast, labelled
 * as such with its date. No number here is typed in, and there is no wallet UI.
 */
import Link from 'next/link'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { deprizeDetailHref, OPEN_FIELD_PROJECT_ID } from '@/lib/deprize/competitions'
import { mergeLiveMarket } from '@/lib/deprize/goal-market'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { TOUCHDOWN_RACE_GOAL_ID } from '@/components/touchdown/TouchdownTeaser'

export const CATCH_RACE_GOAL_ID = TOUCHDOWN_RACE_GOAL_ID
export const HLS_PROJECT_ID = 'spacex-starship-hls'

type Row = { id: string; label: string; odds: number; hls: boolean }

export default function CatchRacePanel({ onMakeYourCall, compact = false }: { onMakeYourCall: () => void; compact?: boolean }) {
  const { selectedChain } = useContext(ChainContextV5)
  const live = useDePrizeGoalOdds(selectedChain, CATCH_RACE_GOAL_ID)

  const goal = useMemo(() => SEED_ATLAS.sharedGoals.find((g) => g.id === CATCH_RACE_GOAL_ID), [])
  const merged = useMemo(() => (goal ? mergeLiveMarket(goal, live) : undefined), [goal, live])
  const isLive = !!merged && merged !== goal && merged.market?.status === 'live' && !!live.oddsByProjectId

  const { rows, hls, hlsRank } = useMemo(() => {
    const odds = merged?.market?.impliedOdds ?? {}
    const named: Row[] = []
    for (const [id, value] of Object.entries(odds)) {
      if (!Number.isFinite(value) || id === OPEN_FIELD_PROJECT_ID) continue
      const project = SEED_ATLAS.projects.find((p) => p.id === id)
      const org = project && SEED_ATLAS.organizations.find((o) => o.id === project.orgId)
      const isHls = id === HLS_PROJECT_ID
      named.push({ id, label: isHls ? 'Starship HLS' : org?.name ?? project?.name ?? id, odds: value, hls: isHls })
    }
    named.sort((a, b) => b.odds - a.odds)
    const at = named.findIndex((r) => r.hls)
    // Starship HLS against the two front-runners (or the top three, when it is one of them).
    const shown = at >= 0 && at > 1 ? [...named.slice(0, 2), named[at]] : named.slice(0, 3)
    return { rows: shown, hls: at >= 0 ? named[at] : undefined, hlsRank: at + 1 }
  }, [merged])

  // "Last updated": for live odds, the moment the numbers last changed here.
  const signature = rows.map((r) => `${r.id}:${r.odds.toFixed(4)}`).join('|')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const lastSig = useRef('')
  useEffect(() => {
    if (!isLive || signature === lastSig.current) return
    lastSig.current = signature
    setUpdatedAt(new Date())
  }, [isLive, signature])

  const max = Math.max(0.01, ...rows.map((r) => r.odds))
  // Only call it the underdog when the numbers say so.
  const standing = !hls ? '' : hlsRank === 1 ? 'Right now it leads the field.' : hlsRank <= 3 ? `Right now it is running #${hlsRank}.` : 'Right now it is the underdog.'

  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.04] ${compact ? 'p-3' : 'p-3.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">The real race</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isLive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/60'
          }`}
        >
          {isLive && (
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
          {isLive ? 'Live odds' : 'Atlas forecast'}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-white">Think Starship HLS will land on the Moon? Make your prediction.</p>
      {standing && <p className="mt-0.5 text-xs leading-snug text-white/60">Next upright lunar landing. {standing}</p>}

      <ul className={compact ? 'mt-2 space-y-1' : 'mt-3 space-y-1.5'}>
        {rows.map((r) => (
          <li key={r.id} className={`relative overflow-hidden rounded-md ${r.hls ? 'bg-amber-300/10 ring-1 ring-amber-300/40' : 'bg-white/[0.05]'}`}>
            <div className={`absolute inset-y-0 left-0 ${r.hls ? 'bg-amber-300/30' : 'bg-sky-400/25'}`} style={{ width: `${(r.odds / max) * 100}%` }} />
            <div className={`relative flex items-center justify-between gap-3 px-2.5 text-[13px] ${compact ? 'py-1' : 'py-1.5'}`}>
              <span className={`truncate ${r.hls ? 'font-bold text-amber-100' : 'text-white/90'}`}>{r.label}</span>
              <span className="tabular-nums font-semibold text-white">{Math.round(r.odds * 100)}%</span>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="rounded-md bg-white/[0.05] px-2.5 py-2 text-[13px] text-white/60">Forecast unavailable right now.</li>}
      </ul>

      <p className="mt-2 text-[11px] leading-snug text-white/45">
        {isLive
          ? `Live market-implied odds. Last updated ${updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}.`
          : `Atlas forecast (a curator estimate, not live odds)${live.loading ? ', checking the live market…' : ''}. Updated ${SEED_ATLAS.updatedAt}.`}
      </p>

      <Link
        href={deprizeDetailHref(CATCH_RACE_GOAL_ID)}
        onClick={onMakeYourCall}
        className={`flex w-full items-center justify-center rounded-lg bg-white px-3 text-sm font-bold text-black transition hover:bg-white/90 ${compact ? 'mt-2 py-2' : 'mt-3 py-2.5'}`}
      >
        Make your prediction →
      </Link>
    </section>
  )
}
