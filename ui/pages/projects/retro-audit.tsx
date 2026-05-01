/**
 * Public Retroactive Rewards audit page (`/projects/retro-audit`).
 *
 * Lets anyone verify the per-quarter retro tally end-to-end without
 * rerunning the pipeline locally. Mirrors `/projects/audit` (member
 * vote) but reflects the retro-specific math: voters split into
 * citizens / non-citizens, contributor zero-out before iterative
 * normalization, and per-project ETH/USDC + MOONEY pool shares
 * instead of approve/fail badges.
 *
 * Defaults to the previous calendar quarter (the one whose projects
 * are typically being retro-tallied right now). `?quarter=` and
 * `?year=` let auditors pin a past cycle.
 */
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'
import type {
  RetroactiveAudit,
  RetroactiveOutcome,
} from '@/lib/proposals/computeRetroactiveOutcome'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type AuditResponse = {
  outcome: (RetroactiveOutcome & { audit?: RetroactiveAudit }) | null
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

const formatPrimary = (amount: number, asset: 'ETH' | 'USDC') =>
  asset === 'ETH'
    ? `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`
    : `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

const formatMooney = (amount: number) =>
  `${Number(amount.toPrecision(3)).toLocaleString()} MOONEY`

export default function ProjectsRetroAuditPage() {
  const router = useRouter()
  // Default to the previous calendar quarter — the cohort currently
  // in the retro-distribution window. Older cycles can be pinned via
  // the URL params.
  const fallback = getRelativeQuarter(-1)

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
      ? `/api/proposals/retro-audit?quarter=${quarter}&year=${year}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      // Always revalidate on mount so a stale `{outcome: null}` left over
      // from an earlier failed compute (e.g. before the cohort detection
      // was fixed) doesn't survive a navigation to the audit page.
      revalidateOnMount: true,
      revalidateIfStale: true,
      dedupingInterval: 60_000,
      errorRetryCount: 1,
    }
  )

  // Treat "router not ready" the same as "loading" — until the URL
  // params are parsed and SWR has actually been keyed, we have no idea
  // whether the requested cycle has data. Without this guard the
  // "no data" ErrorState briefly renders on every fresh mount because
  // `data` is undefined → `!outcome` is truthy.
  const showLoading = !router.isReady || isLoading || (!data && !error)
  const outcome = data?.outcome
  const audit = outcome?.audit

  // Citizen power lookup — used to compute per-row weighted
  // contributions on the project breakdowns. Built off the audit
  // voters list so the ratios match what the tally actually saw.
  const addressToPower = useMemo(() => {
    const map: Record<string, number> = {}
    if (audit?.voters)
      for (const v of audit.voters) if (v.isCitizen) map[v.address] = v.power
    return map
  }, [audit])

  const totalCitizenPower = outcome?.totalCitizenPower || 0

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

  const yearOptions = useMemo(() => {
    const base = fallback.year
    return [base - 1, base, base + 1]
  }, [fallback.year])

  return (
    <section id="retro-audit-container" className="overflow-hidden">
      <Head
        title="Retroactive Rewards Audit"
        description="Per-voter and per-project breakdown of MoonDAO's quarterly Retroactive Rewards tally."
      />
      <Container>
        <ContentLayout
          header="Retroactive Rewards Audit"
          headerSize="max(20px, 3vw)"
          description={
            <p>
              Public, reproducible breakdown of the quarterly Retroactive
              Rewards tally — voters and their voting power, every
              project&apos;s citizen supporters, and the resulting share
              of the ETH/USDC and MOONEY pools. Voting power is √vMOONEY
              at vote close; citizen votes get zeroed for projects they
              contributed to and refilled with the column average;
              non-citizen votes are projected onto the citizen-vote basis
              via L1 best-fit before the quadratic tally.{' '}
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

            {showLoading && <LoadingState />}
            {error && !showLoading && (
              <ErrorState message="Could not load the audit data. Try again in a moment." />
            )}
            {!showLoading && !error && outcome && audit && (
              <AuditBody
                outcome={outcome}
                audit={audit}
                addressToPower={addressToPower}
                totalCitizenPower={totalCitizenPower}
              />
            )}
            {/* Only surface "no data" when we've actually received a
                response (i.e. `data` is defined) — otherwise an
                in-flight request would briefly flash the empty-state
                message before the payload lands. */}
            {!showLoading && !error && data && (!outcome || !audit) && (
              <ErrorState
                message={`No retro tally data is available yet for Q${quarter} ${year}. Either no projects are eligible for retro rewards or no votes have been cast.`}
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
          key={`retro-audit-skeleton-${i}`}
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
  totalCitizenPower,
}: {
  outcome: RetroactiveOutcome
  audit: RetroactiveAudit
  addressToPower: Record<string, number>
  totalCitizenPower: number
}) {
  const closeDate = new Date(outcome.voteCloseTimestamp * 1000)
  const allocatedPrimary = outcome.results.reduce(
    (sum, r) => sum + (r.primaryShare || 0),
    0
  )
  const allocatedMooney = outcome.results.reduce(
    (sum, r) => sum + (r.mooneyShare || 0),
    0
  )

  return (
    <>
      <SummaryCard
        outcome={outcome}
        closeDate={closeDate}
        voterCount={audit.voters.length}
        allocatedPrimary={allocatedPrimary}
        allocatedMooney={allocatedMooney}
      />
      <ProjectsList
        outcome={outcome}
        audit={audit}
        addressToPower={addressToPower}
        totalCitizenPower={totalCitizenPower}
        totalPower={outcome.totalPower}
      />
    </>
  )
}

function SummaryCard({
  outcome,
  closeDate,
  voterCount,
  allocatedPrimary,
  allocatedMooney,
}: {
  outcome: RetroactiveOutcome
  closeDate: Date
  voterCount: number
  allocatedPrimary: number
  allocatedMooney: number
}) {
  return (
    <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/30 border border-white/10 rounded-lg sm:rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <h2 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
            Q{outcome.quarter} {outcome.year} Retro Tally
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Snapshot at vote close ({closeDate.toLocaleString()}). Voting
            power = √vMOONEY across all chains. Citizens drive the
            tally; non-citizen votes are projected onto the citizen-vote
            basis via L1 best-fit.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          label="Voters"
          value={`${voterCount} (${outcome.citizenVoterCount} citizen)`}
        />
        <StatTile
          label="Citizen power"
          value={formatNumber(outcome.totalCitizenPower, 0)}
        />
        <StatTile
          label={`Pool (${outcome.pool.primaryAsset})`}
          value={`${formatPrimary(
            allocatedPrimary,
            outcome.pool.primaryAsset
          )} / ${formatPrimary(
            outcome.pool.primaryAmount,
            outcome.pool.primaryAsset
          )}`}
        />
        <StatTile
          label="Pool (MOONEY)"
          value={`${formatMooney(allocatedMooney)} / ${formatMooney(
            outcome.pool.mooneyAmount
          )}`}
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

function ProjectsList({
  outcome,
  audit,
  addressToPower,
  totalCitizenPower,
  totalPower,
}: {
  outcome: RetroactiveOutcome
  audit: RetroactiveAudit
  addressToPower: Record<string, number>
  totalCitizenPower: number
  totalPower: number
}) {
  // Single-expand for the same reason as the member-vote audit page —
  // multiple-open is hard to scan on mobile and there's no real
  // use case for diffing two project supporter lists side-by-side.
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
            outcome={outcome}
            contributions={contributions}
            expanded={expanded}
            onToggle={() => setExpandedId(expanded ? null : r.projectId)}
            addressToPower={addressToPower}
            totalCitizenPower={totalCitizenPower}
            totalPower={totalPower}
            contributorAddresses={
              audit.projectIdToContributors[r.projectId] || []
            }
          />
        )
      })}
    </div>
  )
}

function ProjectRow({
  outcomeRow,
  outcome,
  contributions,
  expanded,
  onToggle,
  addressToPower,
  totalCitizenPower,
  totalPower,
  contributorAddresses,
}: {
  outcomeRow: RetroactiveOutcome['results'][number]
  outcome: RetroactiveOutcome
  contributions: RetroactiveAudit['contributions'][string]
  expanded: boolean
  onToggle: () => void
  addressToPower: Record<string, number>
  /** Total √vMOONEY across all CITIZEN voters in the cycle. */
  totalCitizenPower: number
  /** Total √vMOONEY across ALL voters (citizen + non-citizen) in the cycle. */
  totalPower: number
  contributorAddresses: string[]
}) {
  // Per-voter weighted contribution (citizens only) is in voting-power
  // units: weighted = (normalizedPct / 100) × voter power. Summed
  // across the project's citizen supporters, that gives the project's
  // total weighted citizen support feeding into `runQuadraticVoting`.
  const totalWeighted = contributions.reduce(
    (sum, c) =>
      sum +
      ((c.normalizedPct || 0) / 100) *
        (addressToPower[c.voterAddress] || 0),
    0
  )
  // Reproduce `outcomeRow.percentage` from first principles so the
  // footer reconciles with the value shown at the top of the row.
  // Derivation: `runQuadraticVoting` (rewards.ts) computes raw
  // weighted shares for every key fed in (real project ids from
  // citizen rows + integer indices from the non-citizen best-fit
  // projection), then renormalizes the whole vector so it sums to
  // 90 (10% community-circle reservation). For a real project P:
  //   raw[P] = Σ_citizens (norm_pct[c,P] × power[c]) / votingPowerSum
  // The renormalizer's sum is dominated by citizens because each
  // citizen row sums to 100 while each non-citizen best-fit row sums
  // to 1 (`minimizeL1Distance` constraint), so:
  //   sum = (100·citizenPower + nonCitizenPower) / votingPowerSum
  //   final[P] = raw[P] / sum × 90
  //            = totalWeighted × 9000
  //              / (100·citizenPower + nonCitizenPower)
  // (totalWeighted absorbs the /100 already, so multiply by 100·90
  //  in the numerator.)
  const denom = 100 * totalCitizenPower + (totalPower - totalCitizenPower)
  const reproducedFinal =
    denom > 0 ? (totalWeighted * 100 * 90) / denom : 0

  const projectLink =
    outcomeRow.MDP != null && outcomeRow.MDP !== ''
      ? `/project/${outcomeRow.MDP}`
      : null
  const hasShare = outcomeRow.percentage > 0

  return (
    <div
      className={`border rounded-lg ${
        hasShare
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
            hasShare
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
              : 'bg-white/5 text-gray-400 border border-white/10'
          }`}
        >
          {outcomeRow.rank}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              hasShare ? 'text-white' : 'text-gray-300'
            }`}
          >
            {outcomeRow.MDP != null ? `MDP-${outcomeRow.MDP}: ` : ''}
            {outcomeRow.name}
          </p>
          <p className="text-[11px] text-gray-500">
            {formatPrimary(outcomeRow.primaryShare, outcome.pool.primaryAsset)}
            {' • '}
            {formatMooney(outcomeRow.mooneyShare)}
            {' • '}
            {contributions.length} citizen supporter
            {contributions.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right flex-shrink-0 min-w-[72px]">
          <p
            className={`font-GoodTimes text-base sm:text-lg leading-none ${
              hasShare ? 'text-emerald-300' : 'text-gray-400'
            }`}
          >
            {outcomeRow.percentage.toFixed(2)}%
          </p>
          <p
            className={`text-[10px] font-RobotoMono uppercase tracking-wider mt-1 ${
              hasShare ? 'text-emerald-400' : 'text-gray-500'
            }`}
          >
            of pool
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
            {contributorAddresses.length > 0 && (
              <span className="bg-black/30 border border-white/10 text-gray-300 px-2 py-1 rounded">
                Contributors: {contributorAddresses.length}
              </span>
            )}
          </div>

          {contributions.length === 0 ? (
            <p className="text-xs text-gray-500 italic mt-1">
              No citizen allocations after contributor zero-out.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-gray-400 font-RobotoMono">
                      <th className="text-left py-2 px-2 sm:px-3">Voter</th>
                      <th className="text-right py-2 px-2 sm:px-3">Power</th>
                      <th
                        className="text-right py-2 px-2 sm:px-3"
                        title="What this voter wrote in their distribution before contributor zero-out / normalization."
                      >
                        Raw %
                      </th>
                      <th
                        className="text-right py-2 px-2 sm:px-3"
                        title="What was counted after zero-out + iterative normalization. For voters who didn't contribute to this project and whose row already sums to 100, this equals Raw %. Contributor cells are imputed with the column average of the other voters."
                      >
                        Normalized %
                      </th>
                      <th
                        className="text-right py-2 px-2 sm:px-3"
                        title="The slice of this voter's power that went to this project: (normalized % / 100) × power."
                      >
                        Weighted
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((c) => {
                      const power = addressToPower[c.voterAddress] || 0
                      const weighted = ((c.normalizedPct || 0) / 100) * power
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
                            {c.isContributor && (
                              <span className="ml-2 inline-block text-[10px] uppercase tracking-wider bg-amber-500/15 border border-amber-400/30 text-amber-200 px-1.5 py-0.5 rounded">
                                Contributor
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                            {formatNumber(power, 1)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs text-gray-400">
                            {c.rawPct == null
                              ? '—'
                              : `${c.rawPct.toFixed(1)}%`}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                            {c.normalizedPct.toFixed(2)}%
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-right font-RobotoMono text-xs">
                            {formatNumber(weighted, 1)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ProjectFooter
                totalWeighted={totalWeighted}
                totalCitizenPower={totalCitizenPower}
                totalNonCitizenPower={totalPower - totalCitizenPower}
                reproducedFinal={reproducedFinal}
                finalPercentage={outcomeRow.percentage}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectFooter({
  totalWeighted,
  totalCitizenPower,
  totalNonCitizenPower,
  reproducedFinal,
  finalPercentage,
}: {
  totalWeighted: number
  totalCitizenPower: number
  totalNonCitizenPower: number
  reproducedFinal: number
  finalPercentage: number
}) {
  // Tiny float drift between the from-first-principles reproduction
  // and what the server sent is fine — flag a visible mismatch only
  // when the gap is large enough to indicate a real audit failure.
  const drift = Math.abs(reproducedFinal - finalPercentage)
  const matches = drift < 0.01
  return (
    <div className="mt-3 bg-black/30 border border-white/10 rounded-md px-3 py-2 sm:px-4 sm:py-3 font-RobotoMono text-xs text-gray-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-gray-400">Σ weighted (this project)</span>
        <span className="text-white">{formatNumber(totalWeighted, 2)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap mt-1">
        <span className="text-gray-400">Total citizen power</span>
        <span className="text-white">
          {formatNumber(totalCitizenPower, 2)}
        </span>
      </div>
      {totalNonCitizenPower > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap mt-1">
          <span className="text-gray-400">
            Total non-citizen power (× 0.01 vs. citizens via L1 best-fit)
          </span>
          <span className="text-white">
            {formatNumber(totalNonCitizenPower, 2)}
          </span>
        </div>
      )}
      <div className="border-t border-white/10 mt-2 pt-2 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-gray-400">
          Final share = Σ weighted × 9000 ÷ (100 × citizen power +
          non-citizen power)
        </span>
        <span className={matches ? 'text-emerald-200' : 'text-amber-200'}>
          {reproducedFinal.toFixed(4)}%
          {matches ? (
            <span className="ml-2 text-gray-500">
              (matches {finalPercentage.toFixed(2)}% above)
            </span>
          ) : (
            <span className="ml-2 text-gray-400">
              (server reported {finalPercentage.toFixed(4)}%)
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
