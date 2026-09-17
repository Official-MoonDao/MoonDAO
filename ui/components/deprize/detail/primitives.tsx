import { DePrizeState, DEPRIZE_STATE_META } from '@/lib/deprize/constants'

export const CARD =
  'p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg'

export function StateBadge({
  state,
  labelOverride,
  toneOverride,
}: {
  state: DePrizeState
  labelOverride?: string
  toneOverride?: 'amber'
}) {
  const meta = DEPRIZE_STATE_META[state]
  const tone = toneOverride
    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
    : state === DePrizeState.OPEN
      ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
      : state === DePrizeState.M2_COMPLETE
        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
        : [DePrizeState.CANCELLED, DePrizeState.NO_WINNER, DePrizeState.M2_FAILED].includes(state)
          ? 'bg-red-500/10 text-red-200 border-red-500/30'
          : state === DePrizeState.SUPERSEDED
            ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
            : 'bg-white/10 text-gray-200 border-white/20'
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${tone}`}>
      {labelOverride ?? meta?.label ?? 'Unknown'}
    </span>
  )
}

export function Stat({
  label,
  title,
  href,
  children,
}: {
  label: string
  title?: string
  /** When set, the whole stat is a link (e.g. Prize pool → launchpad). */
  href?: string
  children: React.ReactNode
}) {
  const body = (
    <>
      <p
        className={`text-xs ${
          href
            ? 'text-indigo-300/90 underline-offset-2 group-hover:underline'
            : title
              ? 'text-gray-400 cursor-help'
              : 'text-gray-400'
        }`}
        title={title}
      >
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          href ? 'text-white group-hover:text-indigo-200 transition-colors' : 'text-white'
        }`}
      >
        {children}
      </p>
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        title={title}
        className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
      >
        {body}
      </a>
    )
  }
  return <div>{body}</div>
}

export function Notice({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : 'bg-red-500/10 border-red-500/30 text-red-200'
  return <div className={`p-4 rounded-2xl border text-sm ${cls}`}>{children}</div>
}
