import { CheckIcon, ChevronDownIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import type { MoonbasePicksStatus } from '@/lib/my-moonbase/useMoonbasePicks'
import type { AssetInfo } from './assets'

export type InventoryRace = {
  goal: SharedGoal
  /** Hardware the visitor backs in this race. Empty when they have not predicted it. */
  assets: AssetInfo[]
  /** Competitors that can be predicted, by outcome slot. */
  field: { index: number; asset: AssetInfo }[]
  /** Why this race cannot be predicted right now, if it cannot. */
  closedReason?: string
}

function raceHref(goalId: string): string {
  return `/moonbase?race=${encodeURIComponent(goalId)}`
}

// The race's competitors, each with a Predict button that saves in place.
function RaceField({
  race,
  onPredict,
}: {
  race: InventoryRace
  onPredict: (goalId: string, index: number, name: string) => void
}) {
  const backed = new Set(race.assets.map((asset) => asset.project.id))
  // The races near the bottom open below the fold of a short panel.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Block body: Chrome's scrollIntoView returns a Promise, and an arrow
    // expression would hand that Promise to React as the effect cleanup.
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return (
    <div ref={ref} className="mx-1 mb-2 mt-1 rounded-lg border border-white/10 bg-black/30 p-1.5">
      {race.closedReason ? (
        <p className="px-1.5 py-1 text-[11px] text-amber-200/90">{race.closedReason}</p>
      ) : (
        <p className="px-1.5 pb-1 text-[11px] text-white/50">
          Who wins this one? Your pick is free and unlocks its hardware.
        </p>
      )}
      <ul className="space-y-0.5">
        {race.field.map(({ index, asset }) => {
          const mine = backed.has(asset.project.id)
          return (
            <li key={asset.project.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: asset.accent }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-white">{asset.project.name}</span>
                <span className="block truncate text-[10px] text-white/40">{asset.orgName}</span>
              </span>
              {mine ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <CheckIcon className="h-3 w-3" />
                  Your pick
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!!race.closedReason}
                  onClick={() => onPredict(race.goal.id, index, asset.project.name)}
                  className="shrink-0 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Predict
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <Link
        href={raceHref(race.goal.id)}
        className="mt-1 block px-1.5 text-[11px] text-white/45 hover:text-white"
      >
        Odds and details on Moon Base Zero
      </Link>
    </div>
  )
}

function StatusNote({
  status,
  hasPicks,
  onSignIn,
  onRetry,
}: {
  status: MoonbasePicksStatus
  hasPicks: boolean
  onSignIn: () => void
  onRetry: () => void
}) {
  if (status === 'loading') {
    return <p className="text-xs text-white/55">Reading your predictions…</p>
  }
  if (status === 'error') {
    return (
      <p className="text-xs text-amber-200/90">
        Could not read your predictions.{' '}
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      </p>
    )
  }
  if (status === 'unsupported') {
    return (
      <p className="text-xs text-amber-200/90">
        Predictions are not saved on this network. Switch network to load your hardware.
      </p>
    )
  }
  if (hasPicks) return null
  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-white/70">
        Open a race below and predict who wins it. That hardware is then yours to place.
        Predicting is free.
      </p>
      {status === 'signed-out' && (
        <button
          type="button"
          onClick={onSignIn}
          className="w-full text-center text-[11px] text-white/55 underline-offset-2 hover:text-white hover:underline"
        >
          Already predicted? Sign in
        </button>
      )}
    </div>
  )
}

export default function InventoryPanel({
  races,
  status,
  placedRefs,
  pendingRef,
  onPlace,
  onFind,
  onSignIn,
  onRetry,
  onPredict,
}: {
  races: InventoryRace[]
  status: MoonbasePicksStatus
  /** Asset ids already standing on the plot. */
  placedRefs: ReadonlySet<string>
  /** Asset id riding the pointer, if any. */
  pendingRef: string | null
  onPlace: (projectId: string) => void
  onFind: (projectId: string) => void
  onSignIn: () => void
  onRetry: () => void
  onPredict: (goalId: string, index: number, name: string) => void
}) {
  const predicted = races.filter((race) => race.assets.length > 0)
  const unpicked = races.filter((race) => race.assets.length === 0)
  // One race open at a time, so the list stays short enough to read.
  const [expanded, setExpanded] = useState<string | null>(null)
  const toggle = (goalId: string) => setExpanded((prev) => (prev === goalId ? null : goalId))

  return (
    <div className="pointer-events-auto flex min-h-0 w-full flex-col rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <h2 className="text-sm font-semibold text-white">Your hardware</h2>
        <span className="text-[11px] text-white/45">
          {predicted.length} of {races.length} races predicted
        </span>
      </div>
      <div className="px-4 pb-1 pt-2 empty:hidden">
        <StatusNote
          status={status}
          hasPicks={predicted.length > 0}
          onSignIn={onSignIn}
          onRetry={onRetry}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3 pt-2">
        {predicted.map((race) => {
          const { goal, assets } = race
          const open = expanded === goal.id
          return (
          <section key={goal.id}>
            <div className="flex items-center gap-2 px-2">
              <h3 className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {goal.title}
              </h3>
              <button
                type="button"
                onClick={() => toggle(goal.id)}
                aria-expanded={open}
                className="shrink-0 text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200"
              >
                {open ? 'Done' : 'Change'}
              </button>
            </div>
            {open && <RaceField race={race} onPredict={onPredict} />}
            <ul className="mt-1 space-y-1">
              {assets.map((asset) => {
                const id = asset.project.id
                const placed = placedRefs.has(id)
                const placing = pendingRef === id
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                      placing ? 'bg-cyan-300/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: asset.accent }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-white">
                        {asset.project.name}
                      </span>
                      <span className="block truncate text-[11px] text-white/45">
                        {asset.orgName}
                      </span>
                    </span>
                    {placed ? (
                      <button
                        type="button"
                        onClick={() => onFind(id)}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                      >
                        <CheckIcon className="h-3 w-3 text-emerald-300" />
                        Find
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onPlace(id)}
                        aria-pressed={placing}
                        className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                          placing
                            ? 'bg-cyan-300 text-black'
                            : 'bg-white/10 text-white hover:bg-cyan-300 hover:text-black'
                        }`}
                      >
                        {placing ? 'Placing' : 'Place'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
          )
        })}

        {unpicked.length > 0 && (
          <section>
            <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Predict to unlock
            </h3>
            <ul className="mt-1 space-y-0.5">
              {unpicked.map((race) => {
                const open = expanded === race.goal.id
                return (
                  <li key={race.goal.id}>
                    <button
                      type="button"
                      onClick={() => toggle(race.goal.id)}
                      aria-expanded={open}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white/5 hover:text-white ${
                        open ? 'bg-white/5 text-white' : 'text-white/55'
                      }`}
                    >
                      <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-white/35" />
                      <span className="min-w-0 flex-1 truncate">{race.goal.title}</span>
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 shrink-0 text-cyan-300 transition ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {open && <RaceField race={race} onPredict={onPredict} />}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
