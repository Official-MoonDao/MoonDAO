import Link from 'next/link'

/** Goal id of the First Tracks race in the atlas dataset. */
export const FIRST_TRACKS_RACE_GOAL_ID = 'shared-first-tracks'

/**
 * Entry point into the First Tracks game from the First Tracks race surfaces:
 * the prize page ("Can you drive it?") and the Moon Base atlas race panel
 * ("Try to drive it").
 */
export default function FirstTracksTeaser({ variant }: { variant: 'prize' | 'atlas' }) {
  if (variant === 'atlas') {
    return (
      <Link
        href="/rover"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-300/20"
      >
        Try to drive it
        <span aria-hidden>→</span>
      </Link>
    )
  }
  return (
    <Link
      href="/rover"
      className="group flex items-center justify-between gap-4 rounded-2xl border border-sky-300/20 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-sky-950/40 p-4 transition hover:border-sky-300/50 sm:p-5"
    >
      <div>
        <p className="text-base font-bold text-white">Can you drive it?</p>
        <p className="mt-0.5 text-sm text-gray-400">
          Play Lunar Rover: First Tracks. Drive a rover off its lander and across the Moon through
          real signal delay. Every command arrives late.
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-bold text-black transition group-hover:bg-sky-200">
        Play →
      </span>
    </Link>
  )
}
