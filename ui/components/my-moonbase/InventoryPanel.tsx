import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import type { MoonbasePicksStatus } from '@/lib/my-moonbase/useMoonbasePicks'
import type { AssetInfo } from './assets'

export type InventoryRace = {
  goal: SharedGoal
  /** Hardware the visitor backs in this race. Empty when they have not predicted it. */
  assets: AssetInfo[]
}

function raceHref(goalId: string): string {
  return `/moonbase?race=${encodeURIComponent(goalId)}`
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
        Predict the winner of a race and that hardware is yours to place. Predicting is free.
      </p>
      <Link
        href="/moonbase"
        className="flex w-full items-center justify-center rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-black transition hover:bg-cyan-200"
      >
        Pick a race
      </Link>
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
}) {
  const predicted = races.filter((race) => race.assets.length > 0)
  const open = races.filter((race) => race.assets.length === 0)

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
        {predicted.map(({ goal, assets }) => (
          <section key={goal.id}>
            <h3 className="truncate px-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              {goal.title}
            </h3>
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
        ))}

        {open.length > 0 && (
          <section>
            <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Predict to unlock
            </h3>
            <ul className="mt-1 space-y-0.5">
              {open.map(({ goal }) => (
                <li key={goal.id}>
                  <Link
                    href={raceHref(goal.id)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/55 transition hover:bg-white/5 hover:text-white"
                  >
                    <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-white/35" />
                    <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-cyan-300">Predict</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
