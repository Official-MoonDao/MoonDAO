/**
 * Today's top pilots. Presentational: the game shell fetches the board and
 * passes it in. Renders nothing when the board is unavailable.
 */
import { nameKey, type BoardResponse } from '@/lib/touchdown/leaderboard'
import { formatScore } from '@/lib/touchdown/verdicts'

export default function Leaderboard({
  board,
  highlight,
  rows = 10,
  showRace = false,
}: {
  board: BoardResponse | null
  /** Name to highlight (the player's own entry). */
  highlight?: string
  rows?: number
  /** Add the line that ties the board to the real Touchdown race. */
  showRace?: boolean
}) {
  if (!board || !board.enabled) return null
  const mine = highlight ? nameKey(highlight) : ''
  const top = board.top.slice(0, rows)
  return (
    <section aria-label="Today's leaderboard">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Today&apos;s top pilots{board.mode === 'pro' ? ' · Pro' : ''}
        </h3>
        {board.total > 0 && (
          <span className="text-[10px] tabular-nums text-white/40">
            {board.total} {board.total === 1 ? 'pilot' : 'pilots'}
          </span>
        )}
      </div>
      {top.length === 0 ? (
        <p className="mt-1.5 text-[13px] text-white/60">Nobody has landed today. Be the first on the board.</p>
      ) : (
        <ol className="mt-1.5 space-y-0.5">
          {top.map((e, i) => {
            const me = mine && nameKey(e.name) === mine
            return (
              <li
                key={`${e.name}-${i}`}
                className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[13px] ${
                  me ? 'bg-emerald-400/15 text-emerald-100' : 'text-white/85'
                }`}
              >
                <span className="w-5 shrink-0 text-right tabular-nums text-white/45">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                {e.attempts > 1 && (
                  <span className="shrink-0 text-[10px] tabular-nums text-white/35">{e.attempts} tries</span>
                )}
                <span className="shrink-0 font-bold tabular-nums">{formatScore(e.score)}</span>
              </li>
            )
          })}
        </ol>
      )}
      {board.yesterday && (
        <p className="mt-2 flex items-center gap-2 rounded border border-amber-300/20 bg-amber-300/[0.07] px-1.5 py-1 text-[12px] text-amber-100/90">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/70">
            Yesterday&apos;s winner
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{board.yesterday.name}</span>
          <span className="shrink-0 font-bold tabular-nums">{formatScore(board.yesterday.score)}</span>
        </p>
      )}
      {showRace && (
        <p className="mt-2 text-[11px] leading-snug text-white/45">
          Real landers tip over too. After you land, see who is tipped to land upright next.
        </p>
      )}
    </section>
  )
}
