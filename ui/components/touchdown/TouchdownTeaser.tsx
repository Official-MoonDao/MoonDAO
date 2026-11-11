import Link from 'next/link'

/** Goal id of the Touchdown race in the atlas dataset. */
export const TOUCHDOWN_RACE_GOAL_ID = 'shared-next-landing'

/**
 * Entry point into the Touchdown game from the Touchdown race surfaces:
 * the prize page ("Can you land it?") and the Moon Base atlas race panel
 * ("Try to land it").
 */
export default function TouchdownTeaser({ variant }: { variant: 'prize' | 'atlas' }) {
  if (variant === 'atlas') {
    return (
      <Link
        href="/touchdown"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-300/20"
      >
        Try to land it
        <span aria-hidden>→</span>
      </Link>
    )
  }
  return (
    <Link
      href="/touchdown"
      className="group flex items-center justify-between gap-4 rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/40 p-4 transition hover:border-emerald-300/50 sm:p-5"
    >
      <div>
        <p className="text-base font-bold text-white">Can you land it?</p>
        <p className="mt-0.5 text-sm text-gray-400">
          Fly the one-minute Touchdown game: brake from orbit and set a lander down upright. Real
          landers tip over too.
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-bold text-black transition group-hover:bg-emerald-200">
        Play →
      </span>
    </Link>
  )
}
