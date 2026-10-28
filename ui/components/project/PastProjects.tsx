import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import { HATS_ADDRESS, PROJECT_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useState, useEffect, useContext, useMemo } from 'react'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import ProjectCard from '@/components/project/ProjectCard'

type PastProjectProps = {
  projects: Project[]
}

type QuarterCount = { quarter: number; count: number }
type YearGroup = {
  year: number
  total: number
  quarters: Map<number, Project[]>
}

export function hasFinalReport(p: Project): boolean {
  return Boolean(p.finalReportIPFS || p.finalReportLink)
}

// Member Vote tallies only live in the Proposals table from Q2 2026 on;
// earlier quarters have no member vote audit to link to.
const FIRST_MEMBER_VOTE_AUDIT = { year: 2026, quarter: 2 }
const PAGE_SIZE = 10

function hasMemberVoteAudit(year: number, quarter: number): boolean {
  return (
    year > FIRST_MEMBER_VOTE_AUDIT.year ||
    (year === FIRST_MEMBER_VOTE_AUDIT.year && quarter >= FIRST_MEMBER_VOTE_AUDIT.quarter)
  )
}

function quarterLabel(p: Project): string {
  return `Q${Number(p.quarter) || '?'} ${Number(p.year) || ''}`.trim()
}

function buildYearIndex(projects: Project[]): YearGroup[] {
  const byYear = new Map<number, YearGroup>()
  for (const project of projects) {
    const year = Number(project.year) || 0
    const quarter = Number(project.quarter) || 0
    if (!byYear.has(year)) {
      byYear.set(year, { year, total: 0, quarters: new Map() })
    }
    const yg = byYear.get(year)!
    yg.total += 1
    if (!yg.quarters.has(quarter)) yg.quarters.set(quarter, [])
    yg.quarters.get(quarter)!.push(project)
  }
  return Array.from(byYear.values()).sort((a, b) => b.year - a.year)
}

export default function PastProjects({ projects }: PastProjectProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: selectedChain,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI as any,
    chain: selectedChain,
  })

  const [input, setInput] = useState('')

  const yearGroups = useMemo(() => buildYearIndex(projects), [projects])

  // 'all' lists every past project newest-first; a year narrows to one quarter.
  const [selectedYear, setSelectedYear] = useState<number | 'all' | null>('all')
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Initialize / heal selection when data changes
  useEffect(() => {
    if (!yearGroups.length) {
      setSelectedYear('all')
      setSelectedQuarter(null)
      return
    }
    setSelectedYear((prevYear) => {
      if (prevYear === 'all') return prevYear
      const stillValid = prevYear != null && yearGroups.some((yg) => yg.year === prevYear)
      return stillValid ? prevYear : 'all'
    })
  }, [yearGroups])

  // When year changes, pick the most recent quarter with projects in that year
  useEffect(() => {
    if (selectedYear == null || selectedYear === 'all') {
      setSelectedQuarter(null)
      return
    }
    const yg = yearGroups.find((g) => g.year === selectedYear)
    if (!yg) return
    setSelectedQuarter((prevQ) => {
      if (prevQ != null && yg.quarters.has(prevQ)) return prevQ
      const available = Array.from(yg.quarters.keys()).sort((a, b) => b - a)
      return available[0] ?? null
    })
  }, [selectedYear, yearGroups])

  const activeYearGroup = useMemo(
    () => yearGroups.find((g) => g.year === selectedYear) ?? null,
    [yearGroups, selectedYear]
  )

  const quarterCounts: QuarterCount[] = useMemo(() => {
    if (!activeYearGroup) return []
    return [1, 2, 3, 4].map((q) => ({
      quarter: q,
      count: activeYearGroup.quarters.get(q)?.length ?? 0,
    }))
  }, [activeYearGroup])

  const term = input.trim().toLowerCase()
  // Searching always spans every quarter: people usually search precisely
  // because they don't remember which quarter a project ran in.
  const isListMode = selectedYear === 'all' || term !== ''

  const allProjectsNewestFirst = useMemo(
    () =>
      yearGroups.flatMap((yg) =>
        Array.from(yg.quarters.keys())
          .sort((a, b) => b - a)
          .flatMap((q) => yg.quarters.get(q) ?? [])
      ),
    [yearGroups]
  )

  const matchingProjects = useMemo(() => {
    if (!isListMode) {
      if (!activeYearGroup || selectedQuarter == null) return []
      return activeYearGroup.quarters.get(selectedQuarter) ?? []
    }
    if (!term) return allProjectsNewestFirst
    const mdpTerm = term.replace(/^mdp-?/, '')
    return allProjectsNewestFirst.filter(
      (p) =>
        p.name?.toString().toLowerCase().includes(term) ||
        (mdpTerm !== '' && String(p.MDP ?? '') === mdpTerm)
    )
  }, [isListMode, activeYearGroup, selectedQuarter, term, allProjectsNewestFirst])

  // Start each new list or search back at the first page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedYear, selectedQuarter, term])

  const visibleProjects = isListMode ? matchingProjects.slice(0, visibleCount) : matchingProjects
  const remainingCount = isListMode ? matchingProjects.length - visibleProjects.length : 0

  const activeLabel =
    typeof selectedYear === 'number' && selectedQuarter != null
      ? `Q${selectedQuarter} ${selectedYear}`
      : null

  useChainDefault()

  return (
    <div className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 sm:px-0">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading font-semibold text-white/80 text-base sm:text-xl">
            Past Projects
          </h1>
          <span className="text-[11px] sm:text-xs font-RobotoMono uppercase tracking-wider text-gray-500">
            {projects.length} total
          </span>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-black/30 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
            onChange={({ target }) => setInput(target.value)}
            value={input}
            type="text"
            name="search"
            placeholder="Search all past projects..."
          />
        </div>
      </div>

      {yearGroups.length > 0 && (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 p-2 sm:p-3 flex flex-col gap-2 sm:gap-3">
          {/* Year tabs */}
          <div
            role="tablist"
            aria-label="Select year"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="hidden sm:inline-flex shrink-0 text-[10px] font-RobotoMono uppercase tracking-wider text-gray-500 px-1">
              Year
            </span>
            {[
              { key: 'all' as const, label: 'All', total: projects.length },
              ...yearGroups.map((yg) => ({
                key: yg.year,
                label: String(yg.year),
                total: yg.total,
              })),
            ].map((tab) => {
              const isActive = selectedYear === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedYear(tab.key)}
                  className={`group inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-RobotoMono tracking-wide transition-colors border ${
                    isActive
                      ? 'bg-blue-500/15 border-blue-400/40 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="font-semibold">{tab.label}</span>
                  <span
                    className={`text-[10px] ${
                      isActive ? 'text-blue-200' : 'text-gray-500 group-hover:text-gray-300'
                    }`}
                  >
                    {tab.total}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Quarter buttons (always 4, disabled when empty) */}
          {activeYearGroup && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div
                role="tablist"
                aria-label={`Select quarter in ${selectedYear}`}
                className="flex items-center gap-1.5"
              >
                <span className="hidden sm:inline-flex shrink-0 text-[10px] font-RobotoMono uppercase tracking-wider text-gray-500 px-1">
                  Quarter
                </span>
                <div className="grid grid-cols-4 gap-1.5 flex-1 sm:flex-none sm:inline-grid">
                  {quarterCounts.map(({ quarter, count }) => {
                    const isActive = selectedQuarter === quarter
                    const isDisabled = count === 0
                    return (
                      <button
                        key={quarter}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        onClick={() => setSelectedQuarter(quarter)}
                        className={`relative px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-RobotoMono tracking-wide transition-colors border min-w-[60px] sm:min-w-[72px] ${
                          isDisabled
                            ? 'bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed'
                            : isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-blue-400/40 text-white shadow-sm'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="font-semibold">Q{quarter}</span>
                          <span
                            className={`text-[10px] ${
                              isDisabled
                                ? 'text-gray-700'
                                : isActive
                                ? 'text-blue-200'
                                : 'text-gray-500'
                            }`}
                          >
                            {count}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {!term && activeLabel && (
                <div className="flex flex-wrap gap-1.5 text-[11px] font-RobotoMono">
                  {hasMemberVoteAudit(selectedYear as number, selectedQuarter as number) && (
                    <Link
                      href={`/projects/audit?quarter=${selectedQuarter}&year=${selectedYear}`}
                      className="bg-white/5 border border-white/15 text-gray-200 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                    >
                      View {activeLabel} vote audit →
                    </Link>
                  )}
                  <Link
                    href={`/projects/retro-audit?quarter=${selectedQuarter}&year=${selectedYear}`}
                    className="bg-white/5 border border-white/15 text-gray-200 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                  >
                    View {activeLabel} retro audit →
                  </Link>
                </div>
              )}
            </div>
          )}
          {term && (
            <p className="text-[11px] font-RobotoMono text-gray-500 px-1">
              Searching all quarters: {matchingProjects.length} match
              {matchingProjects.length === 1 ? '' : 'es'}
            </p>
          )}
        </div>
      )}

      {yearGroups.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          No past projects yet.
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          {term
            ? 'No past projects match your search.'
            : activeLabel
            ? `No projects in ${activeLabel}.`
            : 'No past projects yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 sm:gap-6">
          {visibleProjects.map((project, i) => {
            // In the All / search list, label each run of projects with its
            // quarter so results from different cycles stay distinguishable.
            const label = quarterLabel(project)
            const showLabel =
              isListMode && (i === 0 || quarterLabel(visibleProjects[i - 1]) !== label)
            return (
              <div key={`past-project-${project.id}-${i}`} className="flex flex-col gap-1.5">
                {showLabel && (
                  <h2 className="px-1 pt-2 text-[11px] sm:text-xs font-RobotoMono uppercase tracking-wider text-gray-500">
                    {label}
                  </h2>
                )}
                <ProjectCard
                  project={project}
                  projectContract={projectContract}
                  hatsContract={hatsContract}
                  isVotingPeriod={false}
                />
              </div>
            )
          })}
          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="self-center px-4 py-2 rounded-lg text-sm font-RobotoMono bg-white/5 border border-white/15 text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              Show more ({remainingCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
