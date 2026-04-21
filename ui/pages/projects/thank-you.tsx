import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type Allocation = {
  id: string
  name: string
  percent: number
}

type SubmissionType = 'retro' | 'member'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
const DISTRIBUTION_TABLE_NAME = DISTRIBUTION_TABLE_NAMES[chainSlug]
const PROPOSALS_TABLE_NAME = PROPOSALS_TABLE_NAMES[chainSlug]
const PROJECT_TABLE_NAME = PROJECT_TABLE_NAMES[chainSlug]

export default function RewardsThankYou() {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const { quarter: fallbackQuarter, year: fallbackYear } = getRelativeQuarter(-1)

  // Pull the quarter / year / submission type from the redirect URL. The
  // member-vote and retro-distribution flows live in different Tableland
  // tables, so the `type` flag is what tells us which one to query.
  const { quarter, year, type } = useMemo(() => {
    if (!router.isReady)
      return { quarter: fallbackQuarter, year: fallbackYear, type: 'retro' as SubmissionType }
    const rawQuarter = Array.isArray(router.query.quarter)
      ? router.query.quarter[0]
      : router.query.quarter
    const rawYear = Array.isArray(router.query.year)
      ? router.query.year[0]
      : router.query.year
    const rawType = Array.isArray(router.query.type)
      ? router.query.type[0]
      : router.query.type
    const parsedQuarter = rawQuarter ? Number(rawQuarter) : undefined
    const parsedYear = rawYear ? Number(rawYear) : undefined
    return {
      quarter:
        parsedQuarter && parsedQuarter >= 1 && parsedQuarter <= 4
          ? parsedQuarter
          : fallbackQuarter,
      year: parsedYear && parsedYear >= 2020 ? parsedYear : fallbackYear,
      type: (rawType === 'member' ? 'member' : 'retro') as SubmissionType,
    }
  }, [
    router.isReady,
    router.query.quarter,
    router.query.year,
    router.query.type,
    fallbackQuarter,
    fallbackYear,
  ])

  const allocationTableName =
    type === 'member' ? PROPOSALS_TABLE_NAME : DISTRIBUTION_TABLE_NAME

  // Query the correct allocation table (proposals vs distributions). We need
  // both `router.isReady` and a connected wallet before we can fire the
  // query — without those we'd be querying with a fallback quarter or no
  // wallet to filter by.
  const allocationStatement =
    router.isReady && address && allocationTableName
      ? `SELECT * FROM ${allocationTableName} WHERE year = ${year} AND quarter = ${quarter}`
      : null

  const { data: distributions, isLoading: allocationsApiLoading } =
    useTablelandQuery(allocationStatement, {
      revalidateOnFocus: false,
    })

  // Pull the project list for the *URL's* quarter so member-vote allocations
  // (which point at proposals from the current submission quarter, not the
  // rewards-shifted previous quarter) resolve to the right names.
  const projectsStatement =
    router.isReady && PROJECT_TABLE_NAME
      ? `SELECT id, name FROM ${PROJECT_TABLE_NAME} WHERE year = ${year} AND quarter = ${quarter}`
      : null

  const { data: projectsForQuarter } = useTablelandQuery(projectsStatement, {
    revalidateOnFocus: false,
  })

  const userDistribution = useMemo(() => {
    if (!distributions || !address) return undefined
    return distributions.find(
      (distribution: any) =>
        distribution?.address?.toLowerCase() === address.toLowerCase()
    )
  }, [distributions, address])

  // Build a sorted list of non-zero allocations, falling back to a generic
  // "Project #ID" name if the project record isn't available (e.g. when the
  // projects query hasn't finished or a project record was removed).
  const allocations: Allocation[] = useMemo(() => {
    let dist = userDistribution?.distribution as
      | Record<string, number>
      | string
      | undefined
    if (!dist) return []
    // Tableland may return the JSON column as a string depending on the
    // statement — normalize it before iterating.
    if (typeof dist === 'string') {
      try {
        dist = JSON.parse(dist) as Record<string, number>
      } catch {
        return []
      }
    }
    const projectMap = new Map<string, any>()
    if (Array.isArray(projectsForQuarter)) {
      for (const p of projectsForQuarter) projectMap.set(String(p.id), p)
    }
    return Object.entries(dist as Record<string, number>)
      .map(([id, percent]) => ({
        id: String(id),
        name: projectMap.get(String(id))?.name || `Project #${id}`,
        percent: Number(percent) || 0,
      }))
      .filter((a) => a.percent > 0)
      .sort((a, b) => b.percent - a.percent)
  }, [projectsForQuarter, userDistribution])

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, a) => sum + a.percent, 0),
    [allocations]
  )
  const allocationsLoading = !!address && allocationsApiLoading
  const hasAllocations = allocations.length > 0
  const showLoadingState = allocationsLoading && !hasAllocations
  const showEmptyState =
    !!address && !allocationsLoading && !hasAllocations && distributions !== undefined

  const submissionLabel = type === 'member' ? 'project vote' : 'reward distribution'

  const descriptionSection = (
    <p>
      {`You've successfully submitted your Q${quarter} ${year} ${submissionLabel}!`}
    </p>
  )

  return (
    <section id="thank-you-container" className="overflow-hidden">
      <Head title={'Thank You'} />
      <Container>
        <ContentLayout
          header="Thank You!"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-col gap-4 sm:gap-6 w-full">
            {/* Hero confirmation card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 via-purple-600/15 to-slate-800/40 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg p-5 sm:p-7">
              <div
                className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/25 rounded-full blur-3xl pointer-events-none"
                aria-hidden
              />
              <div
                className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/25 rounded-full blur-3xl pointer-events-none"
                aria-hidden
              />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg ring-4 ring-emerald-400/20">
                  <CheckIcon
                    className="w-8 h-8 sm:w-9 sm:h-9 text-white"
                    strokeWidth={3}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-GoodTimes text-xl sm:text-2xl text-white tracking-wider">
                    Vote Submitted
                  </h2>
                  <p className="text-gray-300 text-sm sm:text-base mt-1 leading-relaxed">
                    Your Q{quarter} {year}{' '}
                    {type === 'member' ? 'project vote' : 'reward distribution'}{' '}
                    is recorded on-chain. Thanks for helping shape the next
                    chapter of MoonDAO.
                  </p>
                </div>
              </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatTile label="Quarter" value={`Q${quarter}`} />
              <StatTile label="Year" value={String(year)} />
              <StatTile
                label="Projects"
                value={hasAllocations ? String(allocations.length) : '—'}
              />
            </div>

            {/* Allocation breakdown */}
            <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex items-end justify-between flex-wrap gap-2 mb-1">
                <h3 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
                  Your Submitted Allocation
                </h3>
                {hasAllocations && (
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono">
                    {allocations.length} project
                    {allocations.length === 1 ? '' : 's'} • {totalAllocated}%
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                This is the breakdown your wallet voted for in Q{quarter} {year}.
              </p>

              {showLoadingState && (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={`alloc-skeleton-${i}`}
                      className="bg-slate-800/40 border border-white/10 rounded-lg p-3 sm:p-4 animate-pulse"
                    >
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                      <div className="mt-3 h-2 w-full bg-white/5 rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {hasAllocations && (
                <div className="flex flex-col gap-2">
                  {allocations.map((a) => (
                    <div
                      key={`alloc-${a.id}`}
                      className="bg-slate-800/40 border border-white/10 rounded-lg p-3 sm:p-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-white font-medium text-sm sm:text-base truncate"
                          title={a.name}
                        >
                          {a.name}
                        </span>
                        <span className="font-GoodTimes text-base sm:text-lg text-white tracking-wider shrink-0">
                          {a.percent}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full bg-black/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(a.percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showEmptyState && (
                <p className="text-sm text-gray-400">
                  We couldn&apos;t find a {submissionLabel} for this wallet in
                  Q{quarter} {year}. Try connecting the wallet you voted with,
                  or head back to the projects page to submit one.
                </p>
              )}

              {!address && (
                <p className="text-sm text-gray-400">
                  Connect your wallet to see your allocation for this quarter.
                </p>
              )}

              <p className="mt-4 text-xs sm:text-sm text-gray-400 leading-relaxed">
                Changed your mind? You can resubmit a new allocation any time
                before the quarter ends — it will replace the one above.
              </p>
            </div>

            {/* Update / Return CTAs */}
            <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h4 className="font-GoodTimes text-sm sm:text-base text-white tracking-wider">
                    Want to change your vote?
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Head back to the projects page to submit a new allocation
                    and overwrite this one.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:shrink-0">
                  <Link
                    href="/projects"
                    className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-RobotoMono shadow-lg hover:shadow-xl transition-all duration-200 min-w-[200px]"
                  >
                    <span>Update My Allocation</span>
                    <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-RobotoMono transition-colors min-w-[140px]"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
        {label}
      </div>
      <div className="mt-0.5 sm:mt-1 font-GoodTimes text-lg sm:text-xl tracking-wider text-white truncate">
        {value}
      </div>
    </div>
  )
}
