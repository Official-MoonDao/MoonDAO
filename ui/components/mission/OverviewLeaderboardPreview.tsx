import Link from 'next/link'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import IPFSRenderer from '@/components/layout/IPFSRenderer'

type OverviewLeaderboardPreviewProps = {
  /** Top N entries (already sorted, highest first). */
  leaderboard: LeaderboardEntry[]
  /** Mission ID to thread through the leaderboard CTA so the destination page
   *  can render its "back to mission" affordance. */
  missionId?: string | number
}

const RANK_BADGE_STYLES = [
  // 1st — gold
  'bg-gradient-to-br from-amber-300/40 to-amber-500/30 text-amber-100 ring-1 ring-amber-300/40',
  // 2nd — silver
  'bg-gradient-to-br from-slate-200/30 to-slate-400/20 text-slate-100 ring-1 ring-slate-300/40',
  // 3rd — bronze
  'bg-gradient-to-br from-orange-400/30 to-orange-600/20 text-orange-100 ring-1 ring-orange-300/40',
]

const DEFAULT_RANK_STYLE =
  'bg-white/5 text-gray-300 ring-1 ring-white/10'

function formatTotal(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

/**
 * Compact $OVERVIEW leaderboard preview surfaced on the mission/4 page.
 *
 * Shows the top entries with rank, avatar, name, and totals. Always renders
 * a CTA to the full leaderboard so users can vote in one click — even when
 * the list is empty (early in the campaign).
 */
export default function OverviewLeaderboardPreview({
  leaderboard,
  missionId,
}: OverviewLeaderboardPreviewProps) {
  const fullLeaderboardHref = `/overview-vote${
    missionId != null ? `?from=mission&missionId=${missionId}` : ''
  }`

  const hasEntries = leaderboard.length > 0

  return (
    <section
      data-testid="mission-overview-leaderboard-preview"
      className="w-full max-w-[1200px] bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-900/60 border border-indigo-500/20 rounded-2xl overflow-hidden"
    >
      <div className="px-6 md:px-8 pt-6 pb-2 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-indigo-500/30 shrink-0">
            <span className="text-xl">🚀</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-GoodTimes text-white truncate">
              Fly with Frank Leaderboard
            </h2>
            <p className="text-indigo-200/80 text-xs sm:text-sm">
              Top citizens backed by $OVERVIEW holders
            </p>
          </div>
        </div>
        <Link
          href={fullLeaderboardHref}
          className="shrink-0 text-indigo-200 hover:text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
        >
          View full leaderboard →
        </Link>
      </div>

      <div className="px-6 md:px-8 pb-6 pt-3">
        {hasEntries ? (
          <ol className="flex flex-col gap-2 sm:gap-3">
            {leaderboard.map((entry, index) => {
              const rankStyle =
                index < RANK_BADGE_STYLES.length
                  ? RANK_BADGE_STYLES[index]
                  : DEFAULT_RANK_STYLE
              const citizenHref = entry.citizenName
                ? `/citizen/${generatePrettyLinkWithId(
                    entry.citizenName,
                    entry.citizenId
                  )}`
                : `/citizen/${entry.citizenId}`
              const displayName =
                entry.citizenName || `Citizen #${entry.citizenId}`
              return (
                <li
                  key={entry.delegateeAddress}
                  className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-black/20 border border-white/[0.08] hover:border-indigo-400/30 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full font-bold text-sm ${rankStyle}`}
                  >
                    {index + 1}
                  </div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
                    {entry.citizenImage ? (
                      <IPFSRenderer
                        src={entry.citizenImage}
                        alt={displayName}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                        {displayName[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={citizenHref}
                      className="text-white text-sm sm:text-base font-medium hover:underline truncate block"
                    >
                      {displayName}
                    </Link>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      {entry.delegatorCount} backer
                      {entry.delegatorCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm sm:text-base font-semibold tabular-nums">
                      {formatTotal(entry.totalDelegated)}
                    </p>
                    <p className="text-gray-400 text-[11px] sm:text-xs uppercase tracking-wide">
                      $OVERVIEW
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="rounded-xl bg-black/20 border border-white/[0.08] p-6 text-center">
            <p className="text-gray-300 text-sm sm:text-base font-medium">
              No backers yet — be the first to back a candidate.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Contribute to earn $OVERVIEW, then pledge it to the citizen you
              want to fly with Frank.
            </p>
          </div>
        )}

        <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-gray-400 text-xs sm:text-sm">
            The 25 citizens with the most $OVERVIEW support advance to Round 2.
          </p>
          <Link
            href={fullLeaderboardHref}
            className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/20"
          >
            Back a candidate →
          </Link>
        </div>
      </div>
    </section>
  )
}
