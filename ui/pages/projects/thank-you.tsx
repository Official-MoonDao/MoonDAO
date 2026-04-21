import { CheckIcon } from '@heroicons/react/24/outline'
import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
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

export default function RewardsThankYou({
  distributionTableName,
  projects,
}: {
  distributionTableName: string
  projects: any
}) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const { quarter: fallbackQuarter, year: fallbackYear } = getRelativeQuarter(-1)

  const { quarter, year } = useMemo(() => {
    if (!router.isReady) return { quarter: fallbackQuarter, year: fallbackYear }
    const rawQuarter = Array.isArray(router.query.quarter)
      ? router.query.quarter[0]
      : router.query.quarter
    const rawYear = Array.isArray(router.query.year)
      ? router.query.year[0]
      : router.query.year
    const parsedQuarter = rawQuarter ? Number(rawQuarter) : undefined
    const parsedYear = rawYear ? Number(rawYear) : undefined
    return {
      quarter:
        parsedQuarter && parsedQuarter >= 1 && parsedQuarter <= 4
          ? parsedQuarter
          : fallbackQuarter,
      year: parsedYear && parsedYear >= 2020 ? parsedYear : fallbackYear,
    }
  }, [router.isReady, router.query.quarter, router.query.year, fallbackQuarter, fallbackYear])

  const statement = address
    ? `SELECT * FROM ${distributionTableName} WHERE year = ${year} AND quarter = ${quarter}`
    : null

  const { data: distributions, isLoading } = useTablelandQuery(statement, {
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
  // "Project #ID" name if the project record isn't available (e.g. when a
  // member-vote allocation references proposals that aren't in the
  // retroactive eligible set used by `getStaticProps`).
  const allocations: Allocation[] = useMemo(() => {
    const dist = userDistribution?.distribution as
      | Record<string, number>
      | undefined
    if (!dist) return []
    const projectMap = new Map<string, any>()
    if (Array.isArray(projects)) {
      for (const p of projects) projectMap.set(String(p.id), p)
    }
    return Object.entries(dist)
      .map(([id, percent]) => ({
        id: String(id),
        name: projectMap.get(String(id))?.name || `Project #${id}`,
        percent: Number(percent) || 0,
      }))
      .filter((a) => a.percent > 0)
      .sort((a, b) => b.percent - a.percent)
  }, [projects, userDistribution])

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, a) => sum + a.percent, 0),
    [allocations]
  )
  const allocationsLoading = !!address && isLoading
  const hasAllocations = allocations.length > 0
  const showLoadingState = allocationsLoading && !hasAllocations
  const showEmptyState = !!address && !allocationsLoading && !hasAllocations

  const descriptionSection = (
    <p>
      {`You've successfully submitted your Q${quarter} ${year} project allocations!`}
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
                    Your Q{quarter} {year} allocations are recorded on-chain.
                    Thanks for helping shape the next chapter of MoonDAO.
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
              <div className="flex items-end justify-between flex-wrap gap-2 mb-3 sm:mb-4">
                <h3 className="font-GoodTimes text-base sm:text-lg text-white tracking-wider">
                  Your Allocation
                </h3>
                {hasAllocations && (
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono">
                    {allocations.length} project
                    {allocations.length === 1 ? '' : 's'} • {totalAllocated}%
                  </span>
                )}
              </div>

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
                  We couldn&apos;t find an allocation for this wallet in Q
                  {quarter} {year}. Try connecting the wallet you voted with,
                  or head back to the projects page to submit one.
                </p>
              )}

              {!address && (
                <p className="text-sm text-gray-400">
                  Connect your wallet to see your allocation for this quarter.
                </p>
              )}

              <p className="mt-4 text-xs sm:text-sm text-gray-400 leading-relaxed">
                You can update this allocation at any time before the end of
                the quarter by resubmitting on the{' '}
                <Link
                  href="/projects"
                  className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
                >
                  projects
                </Link>{' '}
                page.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link
                href="/projects"
                className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-RobotoMono shadow-lg hover:shadow-xl transition-all duration-200 min-w-[180px]"
              >
                Back to Projects
              </Link>
              <Link
                href="/"
                className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-RobotoMono transition-colors min-w-[180px]"
              >
                Return Home
              </Link>
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

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const projectTableContract = getContract({
      client: serverClient,
      chain,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
    })

    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName',
    })

    const { quarter, year } = getRelativeQuarter(-1)

    const projectStatement = `SELECT * FROM ${projectTableName} WHERE year = ${year} AND quarter = ${quarter} AND eligible != 0`
    const projects = await queryTable(chain, projectStatement)
    const filteredProjects = projects.filter(
      (project: any) =>
        !BLOCKED_PROJECTS.has(project?.id) && !BLOCKED_MDPS.has(project?.MDP)
    )

    const distributionTableContract = getContract({
      client: serverClient,
      chain,
      address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
      abi: DistributionABI as any,
    })

    const distributionTableName = await readContract({
      contract: distributionTableContract,
      method: 'getTableName',
    })

    return {
      props: {
        distributionTableName,
        projects: filteredProjects,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: {
        distributionTableName: '',
        projects: [],
      },
      revalidate: 60,
    }
  }
}
