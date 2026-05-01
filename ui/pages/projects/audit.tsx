/**
 * Public Member Vote audit page (`/projects/audit`).
 *
 * Lets anyone verify the per-quarter vote tally end-to-end without rerunning
 * the standalone `audit-q2-2026-votes.mjs` script. The data shape mirrors the
 * script: voters (address + vMOONEY power) on top, then a per-project
 * breakdown showing what each supporter contributed (raw → normalized →
 * weighted), with the final approval/budget on the right.
 *
 * Defaults to the current calendar quarter (the one being voted on right
 * now). `?quarter=` and `?year=` let auditors pin a past cycle (e.g.
 * `/projects/audit?quarter=2&year=2026`).
 */
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'
import type {
  MemberVoteAudit,
  MemberVoteOutcome,
} from '@/lib/proposals/computeMemberVoteOutcome'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type AuditResponse = {
  outcome: (MemberVoteOutcome & { audit?: MemberVoteAudit }) | null
  quarter: number
  year: number
}

const QUARTERS = [1, 2, 3, 4] as const

const truncateAddress = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr

const formatNumber = (n: number, digits = 0) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export default function ProjectsAuditPage() {
  const router = useRouter()
  const fallback = getRelativeQuarter(0)

  // Resolve quarter/year strictly from the URL once `router.isReady` is
  // true. Pinning the URL means the audit is sharable / linkable per cycle
  // (the whole point of the page), which a piece of internal state would
  // not give us.
  const { quarter, year } = useMemo(() => {
    if (!router.isReady)
      return { quarter: fallback.quarter, year: fallback.year }
    const rawQuarter = Array.isArray(router.query.quarter)
      ? router.query.quarter[0]
      : router.query.quarter
    const rawYear = Array.isArray(router.query.year)
      ? router.query.year[0]
      : router.query.year
    const parsedQuarter = rawQuarter ? Number(rawQuarter) : NaN
    const parsedYear = rawYear ? Number(rawYear) : NaN
    return {
      quarter:
        parsedQuarter >= 1 && parsedQuarter <= 4
          ? parsedQuarter
          : fallback.quarter,
      year: parsedYear >= 2020 ? parsedYear : fallback.year,
    }
  }, [
    router.isReady,
    router.query.quarter,
    router.query.year,
    fallback.quarter,
    fallback.year,
  ])

  const { data, error, isLoading } = useSWR<AuditResponse>(
    router.isReady
      ? `/api/proposals/vote-audit?quarter=${quarter}&year=${year}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, errorRetryCount: 1 }
  )

  const outcome = data?.outcome
  const audit = outcome?.audit

  // Build a lookup for voter power so per-row weighted contributions can be
  // computed without re-shipping power on every row. Memoized because every
  // project-detail render iterates voters once and we don't want N×M work.
  const addressToPower = useMemo(() => {
    const map: Record<string, number> = {}
    if (audit?.voters) for (const v of audit.voters) map[v.address] = v.power
    return map
  }, [audit])

  const totalPower = audit?.voters?.reduce((s, v) => s + v.power, 0) || 0

  const updateUrl = (nextQuarter: number, nextYear: number) => {
    router.push(
      {
        pathname: router.pathname,
        query: { quarter: nextQuarter, year: nextYear },
      },
      undefined,
      { shallow: true }
    )
  }

  // Year options: anchor at the current calendar year and offer one back/
  // forward so auditors can pick adjacent quarters without us hardcoding a
  // launch year that goes stale.
  const yearOptions = useMemo(() => {
    const base = fallback.year
    return [base - 1, base, base + 1]
  }, [fallback.year])

  return (
    <section id="vote-audit-container" className="overflow-hidden">
      <Head
        title="Member Vote Audit"
        description="Per-voter and per-project breakdown of MoonDAO's quarterly Member Vote tally."
      />
      <Container>
        <ContentLayout
          header="Member Vote Audit"
          headerSize="max(20px, 3vw)"
          description={
            <p>
              Public, reproducible breakdown of the quarterly Member Vote
              tally — voters and their voting power, every project&apos;s
              supporters, and the knapsack-style budget approval. Voting
              power is √vMOONEY at vote close; an author&apos;s own
              project is filled with the column average of the other
              voters; non-author silence counts as 0.{' '}
              <Link
                href="/projects"
                className="underline text-blue-300 hover:text-blue-200"
              >
                Back to projects
              </Link>
              .
            </p>
          }
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-col gap-4 sm:gap-6 w-full">
            <QuarterPicker
              quarter={quarter}
              year={year}
              yearOptions={yearOptions}
              onChange={updateUrl}
            />

            {isLoading && <LoadingState />}
            {error && !isLoading && (
              <ErrorState message="Could not load the audit data. Try again in a moment." />
            )}
            {!isLoading && !error && outcome && audit && (
              <AuditBody
                outcome={outcome}
                audit={audit}
                addressToPower={addressToPower}
                totalPower={totalPower}
              />
            )}
            {!isLoading && !error && (!outcome || !audit) && (
              <ErrorState
                message={`No tally data is available yet for Q${quarter} ${year}. Either the vote hasn't been tallied or no eligible votes were cast.`}
              />
            )}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

function QuarterPicker({
  quarter,
  year,
  yearOptions,
  onChange,
}: {
  quarter: number
  year: number
  yearOptions: number[]
  onChange: (quarter: number, year: number) => void
}) {
  return (
    <div className="bg-slate-800/40 border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <span className="text-xs uppercase tracking-wider text-gray-400 font-RobotoMono">
        Viewing
      </span>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <span>Quarter</span>
          <select
            value={quarter}
            onChange={(e) => onChange(Number(e.target.value), year)}
            className="bg-black/40 border border-white/15 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/40"
          >
            {QUARTERS.map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <span>Year</span>
          <select
            value={year}
            onChange={(e) => onChange(quarter, Number(e.target.value))}
            className="bg-black/40 border border-white/15 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/40"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`audit-skeleton-${i}`}
          className="bg-slate-800/40 border border-white/10 rounded-lg p-4 sm:p-5 animate-pulse"
        >
          <div className="h-3 w-1/3 bg-white/10 rounded" />
          <div className="mt-3 h-2 w-full bg-white/5 rounded-full" />
          <div className="mt-2 h-2 w-2/3 bg-white/5 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-rose-500/5 border border-rose-400/20 text-rose-100 rounded-lg p-4 sm:p-5 text-sm">
      {message}
    </div>
  )
}

function AuditBody({
  outcome,
  audit,
  addressToPower,
  totalPower,
}: {
  outcome: MemberVoteOutcome
  audit: MemberVoteAudit
  addressToPower: Record<string, number>
  totalPower: number
}) {
  const closeDate = new Date(outcome.voteCloseTimestamp * 1000)
  const approvedCount = outcome.results.filter((r) => r.approved).length
  const approvedBudget = outcome.results
    .filter((r) => r.approved)
    .reduce((sum, r) => sum + (r.budget || 0), 0)

  return (
    <>
      <SummaryCard
        outcome={outcome}
        closeDate={closeDate}
        approvedCount={approvedCount}
        approvedBudget={approvedBudget}
        voterCount={audit.voters.length}
      />
      <VotersTable voters={audit.voters} totalPower={totalPower} />
      <ProjectsList
        outcome={outcome}
        audit={audit}
        addressToPower={addressToPower}
      />
    </>
  )
}

function SummaryCard({
  outcome,
  closeDate,
  approvedCount,
  approvedBudget,
  voterCount,
}: {
  outcome: MemberVoteOutcome
  closeDate: Date
  approvedCount: number
  approvedBudget: number
  voterCount: number
}) {
  return (
    <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/30 border border-white/10 rounded-lg sm:rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <h2 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
            Q{outcome.quarter} {outcome.year} Tally
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Snapshot at vote close ({closeDate.toLocaleString()}). Voting
            power = √vMOONEY across all chains; author self-votes are
            stripped before normalization.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatTile label="Voters" value={String(voterCount)} />
        <StatTile
          label="Total power"
          value={formatNumber(outcome.totalVotingPower, 0)}
        />
        <StatTile
          label="Approved"
          value={`${approvedCount}/${outcome.results.length}`}
        />
        <StatTile
          label="Allocated"
          value={`$${formatNumber(
            approvedBudget,
            0
          )} / $${formatNumber(outcome.quarterBudgetUsd, 0)}`}
        />
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
        {label}
      </div>
      <div className="mt-0.5 sm:mt-1 font-GoodTimes text-base sm:text-lg tracking-wider text-white truncate">
        {value}
      </div>
    </div>
  )
}

function VotersTable({
  voters,
  totalPower,
}: {
  voters: MemberVoteAudit['voters']
  totalPower: number
}) {
  // Default-collapsed: a 100+ voter table dumped above the project list
  // would push the actual approval results below the fold on mobile. Power
  // share is the audit-relevant column; everything else (vMOONEY raw
  // balance, allocations cast) is informational and lives behind expand.
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/30 border border-white/10 rounded-lg sm:rounded-xl">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-white/5 rounded-lg sm:rounded-xl transition-colors"
      >
        <div>
          <h3 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
            Voters ({voters.length})
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Voting power per address at vote close. √vMOONEY summed across
            chains.
          </p>
        </div>
        {expanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-300 shrink-0" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-300 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-3 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 font-RobotoMono">
                <th className="text-left py-2 px-2 sm:px-3">#</th>
                <th className="text-left py-2 px-2 sm:px-3">Address</th>
                <th className="text-right py-2 px-2 sm:px-3">vMOONEY</th>
                <th className="text-right py-2 px-2 sm:px-3">Power</th>
                <th className="text-right py-2 px-2 sm:px-3">Share</th>
                <th className="text-right py-2 px-2 sm:px-3">Allocations</th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v, idx) => {
                const share =
                  totalPower > 0 ? (v.power / totalPower) * 100 : 0
                const nonZeroAlloc = Object.values(v.rawDistribution).filter(
                  (n) => Number(n) > 0
                ).length
                return (
                  <tr
                    key={v.address}
                    className="border-t border-white/5 text-gray-200"
                  >
                    <td className="py-2 px-2 sm:px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-2 sm:px-3 font-RobotoMono text-xs">
                      <a
                        href={`https://arbiscan.io/address/${v.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-300 hover:underline"
                      >
                        {truncateAddress(v.address)}
                      </a>
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                      {formatNumber(v.vMOONEY, 0)}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                      {formatNumber(v.power, 1)}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                      {share.toFixed(2)}%
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs text-gray-400">
                      {nonZeroAlloc}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProjectsList({
  outcome,
  audit,
  addressToPower,
}: {
  outcome: MemberVoteOutcome
  audit: MemberVoteAudit
  addressToPower: Record<string, number>
}) {
  // Only one project expanded at a time. Multiple-open quickly turns into a
  // wall of voter rows that's hard to scan, and there's no real use case
  // for comparing two projects' supporter lists side-by-side mid-audit.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Pre-sort outcome by rank ascending (server already sorts but defensive
  // — `outcome.results` is canonical and shouldn't be re-sorted).
  const ranked = outcome.results

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h3 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
          Projects ({ranked.length})
        </h3>
        <span className="text-[11px] uppercase tracking-wider text-gray-400 font-RobotoMono">
          Click a row to see who voted for it
        </span>
      </div>
      {ranked.map((r) => {
        const expanded = expandedId === r.projectId
        const contributions = audit.contributions[r.projectId] || []
        return (
          <ProjectRow
            key={r.projectId}
            outcomeRow={r}
            contributions={contributions}
            expanded={expanded}
            onToggle={() =>
              setExpandedId(expanded ? null : r.projectId)
            }
            addressToPower={addressToPower}
            authorAddress={audit.projectIdToAuthor[r.projectId] || ''}
          />
        )
      })}
    </div>
  )
}

function ProjectRow({
  outcomeRow,
  contributions,
  expanded,
  onToggle,
  addressToPower,
  authorAddress,
}: {
  outcomeRow: MemberVoteOutcome['results'][number]
  contributions: MemberVoteAudit['contributions'][string]
  expanded: boolean
  onToggle: () => void
  addressToPower: Record<string, number>
  authorAddress: string
}) {
  // Per-voter weighted contribution is in voting-power units:
  //   weighted = (normalizedPct / 100) × voter power
  // i.e. "the slice of this voter's power that went to this project".
  // Summed across the project's supporters, that gives the project's
  // total weighted support; dividing by `Total power` (across all
  // voters, not just supporters of this project) reproduces the
  // project's outcome share.
  const totalWeighted = contributions.reduce(
    (sum, c) =>
      sum +
      ((c.normalizedPct || 0) / 100) *
        (addressToPower[c.voterAddress] || 0),
    0
  )

  const projectLink =
    outcomeRow.MDP != null && outcomeRow.MDP !== ''
      ? `/project/${outcomeRow.MDP}`
      : null

  return (
    <div
      className={`border rounded-lg ${
        outcomeRow.approved
          ? 'bg-emerald-500/5 border-emerald-400/20'
          : 'bg-black/20 border-white/10'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 text-left hover:bg-white/5 rounded-lg transition-colors"
        aria-expanded={expanded}
      >
        <div
          className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-bold text-xs ${
            outcomeRow.approved
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
              : 'bg-white/5 text-gray-400 border border-white/10'
          }`}
        >
          {outcomeRow.rank}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              outcomeRow.approved ? 'text-white' : 'text-gray-300'
            }`}
          >
            {outcomeRow.MDP != null ? `MDP-${outcomeRow.MDP}: ` : ''}
            {outcomeRow.name}
          </p>
          <p className="text-[11px] text-gray-500">
            Budget: ${formatNumber(outcomeRow.budget, 0)} •{' '}
            {contributions.length} supporter
            {contributions.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right flex-shrink-0 min-w-[72px]">
          <p
            className={`font-GoodTimes text-base sm:text-lg leading-none ${
              outcomeRow.approved ? 'text-emerald-300' : 'text-gray-400'
            }`}
          >
            {outcomeRow.percentage.toFixed(2)}%
          </p>
          <p
            className={`text-[10px] font-RobotoMono uppercase tracking-wider mt-1 ${
              outcomeRow.approved ? 'text-emerald-400' : 'text-gray-500'
            }`}
          >
            {outcomeRow.approved ? 'Approved' : 'Failed'}
          </p>
        </div>
        <div className="ml-1 sm:ml-2 shrink-0">
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-2 sm:px-4 pb-3 sm:pb-4">
          <div className="flex flex-wrap items-center gap-2 mt-3 mb-2 text-[11px] font-RobotoMono">
            {projectLink && (
              <Link
                href={projectLink}
                className="bg-blue-500/10 border border-blue-400/30 text-blue-200 px-2 py-1 rounded hover:bg-blue-500/20"
              >
                Open project →
              </Link>
            )}
            {authorAddress && (
              <span className="bg-black/30 border border-white/10 text-gray-300 px-2 py-1 rounded">
                Author:{' '}
                <a
                  href={`https://arbiscan.io/address/${authorAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-300 hover:underline"
                >
                  {truncateAddress(authorAddress)}
                </a>
              </span>
            )}
          </div>

          {contributions.length === 0 ? (
            <p className="text-xs text-gray-500 italic mt-1">
              No allocations after author self-vote stripping.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-400 font-RobotoMono">
                    <th className="text-left py-2 px-2 sm:px-3">Voter</th>
                    <th className="text-right py-2 px-2 sm:px-3">Power</th>
                    <th
                      className="text-right py-2 px-2 sm:px-3"
                      title="What this voter wrote in their distribution before author self-vote stripping."
                    >
                      Raw %
                    </th>
                    <th
                      className="text-right py-2 px-2 sm:px-3"
                      title="What was counted after stripping + iterative normalization. For non-author voters whose row already sums to 100, this equals Raw %. For authors, the cell of their own project is imputed with the column average of the other voters; that imputation slightly reduces their other allocations on renormalization."
                    >
                      Normalized %
                    </th>
                    <th
                      className="text-right py-2 px-2 sm:px-3"
                      title="The slice of this voter's power that went to this project: (normalized % / 100) × power. Same units as the Power column. Summing this column for one project gives that project's total weighted support."
                    >
                      Weighted
                    </th>
                    <th className="text-right py-2 px-2 sm:px-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => {
                    const power = addressToPower[c.voterAddress] || 0
                    const weighted = ((c.normalizedPct || 0) / 100) * power
                    const share =
                      totalWeighted > 0
                        ? (weighted / totalWeighted) * 100
                        : 0
                    return (
                      <tr
                        key={c.voterAddress}
                        className="border-t border-white/5 text-gray-200"
                      >
                        <td className="py-2 px-2 sm:px-3 font-RobotoMono text-xs">
                          <a
                            href={`https://arbiscan.io/address/${c.voterAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-300 hover:underline"
                          >
                            {truncateAddress(c.voterAddress)}
                          </a>
                          {c.isAuthor && (
                            <span className="ml-2 inline-block text-[10px] uppercase tracking-wider bg-amber-500/15 border border-amber-400/30 text-amber-200 px-1.5 py-0.5 rounded">
                              Author
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                          {formatNumber(power, 1)}
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs text-gray-400">
                          {c.rawPct == null ? '—' : `${c.rawPct.toFixed(1)}%`}
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                          {c.normalizedPct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                          {formatNumber(weighted, 1)}
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs text-emerald-200">
                          {share.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
