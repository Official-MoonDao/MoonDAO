/**
 * Retroactive Rewards results panel for `/projects`.
 *
 * Fetches the read-only outcome from `/api/proposals/retro-results`
 * and renders a ranked list (% of pool, ETH/USDC + MOONEY shares per
 * project). Doubles as a live preview during the rewards-cycle
 * voting window and a permanent record once the cycle has closed.
 *
 * Renders nothing when:
 *   - The fetch is still loading (avoid flicker on every page load —
 *     the heavy server-side compute can take 5–30s on a cold cache).
 *   - There are no eligible projects / no votes for the requested
 *     quarter yet.
 *   - The endpoint errors out.
 */
import Link from 'next/link'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'
import type { RetroactiveOutcome } from '@/lib/proposals/computeRetroactiveOutcome'

type Props = {
  quarter: number
  year: number
}

const formatPrimary = (amount: number, asset: 'ETH' | 'USDC') =>
  asset === 'ETH'
    ? `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`
    : `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

const formatMooney = (amount: number) =>
  `${Number(amount.toPrecision(3)).toLocaleString()} MOONEY`

export default function RetroactiveResults({ quarter, year }: Props) {
  // SWR with conservative refresh: results only change when new
  // distribution rows land or eligibility flips. 60s dedupe matches
  // the endpoint's `s-maxage=60`.
  const { data, error, isLoading } = useSWR<{
    outcome: RetroactiveOutcome | null
    quarter: number
    year: number
  }>(
    `/api/proposals/retro-results?quarter=${quarter}&year=${year}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      errorRetryCount: 1,
    }
  )

  if (isLoading || error) return null
  const outcome = data?.outcome
  if (!outcome || !outcome.results?.length) return null

  const closeDate = new Date(outcome.voteCloseTimestamp * 1000)
  const totalPctAllocated = outcome.results.reduce(
    (s, r) => s + (r.percentage || 0),
    0
  )
  const totalPrimaryAllocated = outcome.results.reduce(
    (s, r) => s + (r.primaryShare || 0),
    0
  )
  const totalMooneyAllocated = outcome.results.reduce(
    (s, r) => s + (r.mooneyShare || 0),
    0
  )

  return (
    <div className="mb-4 sm:mb-6 bg-gradient-to-br from-emerald-900/20 via-slate-800/30 to-slate-900/40 border border-emerald-400/20 rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-GoodTimes text-white text-base sm:text-lg">
              Retroactive Rewards Results
            </h3>
            <span className="text-[10px] font-RobotoMono uppercase tracking-wider text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 px-1.5 py-0.5 rounded">
              Q{outcome.quarter} {outcome.year}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Snapshot at vote close ({closeDate.toLocaleDateString()}).
            Voting power is √vMOONEY across all chains; citizen votes get
            zeroed for projects they contributed to and refilled with the
            column average. Non-citizen votes are projected onto the
            citizen-vote basis via L1 best-fit before the quadratic tally.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-RobotoMono">
          <span className="bg-black/30 border border-white/10 text-gray-200 px-2 py-1 rounded">
            {outcome.voterCount} voter{outcome.voterCount === 1 ? '' : 's'} (
            {outcome.citizenVoterCount} citizen
            {outcome.citizenVoterCount === 1 ? '' : 's'})
          </span>
          <span
            className="bg-blue-500/10 border border-blue-400/30 text-blue-200 px-2 py-1 rounded"
            title="The pool distributed to projects via this retroactive tally (post-upfront remainder of the quarterly project budget)."
          >
            Project pool:{' '}
            {formatPrimary(outcome.pool.primaryAmount, outcome.pool.primaryAsset)}
            {' + '}
            {formatMooney(outcome.pool.mooneyAmount)}
          </span>
          <span
            className="bg-purple-500/10 border border-purple-400/30 text-purple-200 px-2 py-1 rounded"
            title="The community circle's parallel slice (10% of the original quarterly budget, set aside before upfront project funding). Distributed separately and not part of this tally."
          >
            Community circle:{' '}
            {formatPrimary(
              outcome.pool.communityCirclePrimary,
              outcome.pool.primaryAsset
            )}
            {' + '}
            {formatMooney(outcome.pool.communityCircleMooney)}
          </span>
          <Link
            href={`/projects/retro-audit?quarter=${outcome.quarter}&year=${outcome.year}`}
            className="bg-white/5 border border-white/15 text-gray-200 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
          >
            View audit →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {outcome.results.map((r) => {
          const projectLink =
            r.MDP != null && r.MDP !== '' ? `/project/${r.MDP}` : null
          const hasShare = r.percentage > 0
          return (
            <div
              key={r.projectId}
              className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg border ${
                hasShare
                  ? 'bg-emerald-500/5 border-emerald-400/20'
                  : 'bg-black/20 border-white/10'
              }`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-bold text-xs ${
                  hasShare
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
                      hasShare ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {r.MDP != null && r.MDP !== '' ? `MDP-${r.MDP}: ` : ''}
                    {r.name}
                  </Link>
                ) : (
                  <p
                    className={`text-sm font-medium truncate ${
                      hasShare ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {r.name}
                  </p>
                )}
                <p className="text-[11px] text-gray-500">
                  {formatPrimary(r.primaryShare, outcome.pool.primaryAsset)}
                  {' • '}
                  {formatMooney(r.mooneyShare)}
                </p>
              </div>
              <div className="text-right flex-shrink-0 min-w-[72px]">
                <p
                  className={`font-GoodTimes text-base sm:text-lg leading-none ${
                    hasShare ? 'text-emerald-300' : 'text-gray-400'
                  }`}
                >
                  {r.percentage.toFixed(2)}%
                </p>
                <p
                  className={`text-[10px] font-RobotoMono uppercase tracking-wider mt-1 ${
                    hasShare ? 'text-emerald-400' : 'text-gray-500'
                  }`}
                >
                  of pool
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer summary — totals across all projects so an auditor can
          eyeball that "% of pool" sums to ~100 (each project's share of
          the project pool — community circle is tracked separately on
          the header chip, so it's intentionally NOT included in this
          allocation), and that the per-project pool shares add up to
          the headline project pool. */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3 text-[11px] font-RobotoMono">
        <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
            Allocated
          </div>
          <div className="mt-0.5 text-white truncate">
            {totalPctAllocated.toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
            Distributed ({outcome.pool.primaryAsset})
          </div>
          <div className="mt-0.5 text-white truncate">
            {formatPrimary(totalPrimaryAllocated, outcome.pool.primaryAsset)}
          </div>
        </div>
        <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
            Distributed (MOONEY)
          </div>
          <div className="mt-0.5 text-white truncate">
            {formatMooney(totalMooneyAllocated)}
          </div>
        </div>
      </div>
    </div>
  )
}
