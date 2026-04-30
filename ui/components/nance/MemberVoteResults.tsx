/**
 * Member Vote results panel for `/projects`.
 *
 * Fetches the read-only outcome from `/api/proposals/vote-results` and
 * renders a ranked list (% share, approved/failed badge, budget, MDP).
 *
 * Renders nothing when:
 *   - The fetch is still loading (avoid empty-state flicker on every page
 *     load — the heavy server-side compute can take 5–20s on a cold cache).
 *   - There are no votes for the requested quarter yet.
 *   - The endpoint errors out.
 */
import Link from 'next/link'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'
import type { MemberVoteOutcome } from '@/lib/proposals/computeMemberVoteOutcome'

type Props = {
  quarter: number
  year: number
}

export default function MemberVoteResults({ quarter, year }: Props) {
  // SWR with conservative refresh: results only change when the EB re-runs
  // the tally (rare). 60s dedupe matches the endpoint's `s-maxage=60`.
  const { data, error, isLoading } = useSWR<{
    outcome: MemberVoteOutcome | null
    quarter: number
    year: number
  }>(`/api/proposals/vote-results?quarter=${quarter}&year=${year}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    errorRetryCount: 1,
  })

  if (isLoading || error) return null
  const outcome = data?.outcome
  if (!outcome || !outcome.results?.length) return null

  const approvedCount = outcome.results.filter((r) => r.approved).length
  const totalApprovedBudget = outcome.results
    .filter((r) => r.approved)
    .reduce((sum, r) => sum + (r.budget || 0), 0)
  // Source the pool size from the outcome itself rather than a separately-
  // passed prop so the header can never disagree with the budget cap the
  // tally pipeline actually applied (`getApprovedProjects` uses
  // `outcome.quarterBudgetUsd` end-to-end).
  const quarterBudgetUsd = outcome.quarterBudgetUsd
  const closeDate = new Date(outcome.voteCloseTimestamp * 1000)

  return (
    <div className="mb-4 sm:mb-6 bg-gradient-to-br from-emerald-900/20 via-slate-800/30 to-slate-900/40 border border-emerald-400/20 rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-GoodTimes text-white text-base sm:text-lg">
              Member Vote Results
            </h3>
            <span className="text-[10px] font-RobotoMono uppercase tracking-wider text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 px-1.5 py-0.5 rounded">
              Q{outcome.quarter} {outcome.year}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Snapshot at vote close ({closeDate.toLocaleDateString()}). Voting
            power is √vMOONEY across all chains; author self-votes are
            stripped before the tally.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-RobotoMono">
          <span className="bg-black/30 border border-white/10 text-gray-200 px-2 py-1 rounded">
            {outcome.voterCount} voter{outcome.voterCount === 1 ? '' : 's'}
          </span>
          <span className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-2 py-1 rounded">
            {approvedCount}/{outcome.results.length} approved
          </span>
          <span className="bg-blue-500/10 border border-blue-400/30 text-blue-200 px-2 py-1 rounded">
            ${totalApprovedBudget.toLocaleString()} of $
            {quarterBudgetUsd.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {outcome.results.map((r) => {
          // Link to the full project page (`/project/<MDP>`) rather than
          // the legacy Nance-only proposal viewer (`/proposal/<MDP>`) so
          // each row lands on the same surface the rest of the UI
          // (dashboard, ProposalInfo, ProjectCard) navigates to.
          const projectLink =
            r.MDP != null && r.MDP !== '' ? `/project/${r.MDP}` : null
          return (
            <div
              key={r.projectId}
              className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg border ${
                r.approved
                  ? 'bg-emerald-500/5 border-emerald-400/20'
                  : 'bg-black/20 border-white/10'
              }`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-bold text-xs ${
                  r.approved
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {r.rank}
              </div>
              <div className="flex-1 min-w-0">
                {projectLink ? (
                  <Link
                    href={projectLink}
                    className={`text-sm font-medium hover:underline truncate block ${
                      r.approved ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {r.MDP != null ? `MDP-${r.MDP}: ` : ''}
                    {r.name}
                  </Link>
                ) : (
                  <p
                    className={`text-sm font-medium truncate ${
                      r.approved ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {r.name}
                  </p>
                )}
                <p className="text-[11px] text-gray-500">
                  Budget: ${r.budget.toLocaleString()}
                </p>
              </div>
              <div className="text-right flex-shrink-0 min-w-[72px]">
                <p
                  className={`font-GoodTimes text-base sm:text-lg leading-none ${
                    r.approved ? 'text-emerald-300' : 'text-gray-400'
                  }`}
                >
                  {r.percentage.toFixed(2)}%
                </p>
                <p
                  className={`text-[10px] font-RobotoMono uppercase tracking-wider mt-1 ${
                    r.approved ? 'text-emerald-400' : 'text-gray-500'
                  }`}
                >
                  {r.approved ? 'Approved' : 'Failed'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
