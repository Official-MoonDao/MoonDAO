import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import { HATS_ADDRESS, PROJECT_ADDRESSES } from 'const/config'
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
  const finalReportProjects = useMemo(
    () => projects.filter(hasFinalReport),
    [projects]
  )
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

  const yearGroups = useMemo(
    () => buildYearIndex(finalReportProjects),
    [finalReportProjects]
  )

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null)

  // Initialize / heal selection when data changes
  useEffect(() => {
    if (!yearGroups.length) {
      setSelectedYear(null)
      setSelectedQuarter(null)
      return
    }
    setSelectedYear((prevYear) => {
      const stillValid =
        prevYear != null && yearGroups.some((yg) => yg.year === prevYear)
      return stillValid ? prevYear : yearGroups[0].year
    })
  }, [yearGroups])

  // When year changes, pick the most recent quarter with projects in that year
  useEffect(() => {
    if (selectedYear == null) {
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

  const visibleProjects = useMemo(() => {
    if (!activeYearGroup || selectedQuarter == null) return []
    const list = activeYearGroup.quarters.get(selectedQuarter) ?? []
    const term = input.trim().toLowerCase()
    if (!term) return list
    return list.filter((p) =>
      p.name?.toString().toLowerCase().includes(term)
    )
  }, [activeYearGroup, selectedQuarter, input])

  const activeLabel =
    selectedYear != null && selectedQuarter != null
      ? `Q${selectedQuarter} ${selectedYear}`
      : null

  useChainDefault()

  return (
    <div className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 sm:px-0">
        <div className="flex items-baseline gap-3">
          <h1 className="font-GoodTimes text-white/80 text-base sm:text-xl">
            Past Projects
          </h1>
          <span className="text-[11px] sm:text-xs font-RobotoMono uppercase tracking-wider text-gray-500">
            {finalReportProjects.length} total
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
            placeholder={
              activeLabel ? `Search ${activeLabel}...` : 'Search past projects...'
            }
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
            {yearGroups.map((yg) => {
              const isActive = selectedYear === yg.year
              return (
                <button
                  key={yg.year}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedYear(yg.year)}
                  className={`group inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-RobotoMono tracking-wide transition-colors border ${
                    isActive
                      ? 'bg-blue-500/15 border-blue-400/40 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="font-semibold">{yg.year}</span>
                  <span
                    className={`text-[10px] ${
                      isActive ? 'text-blue-200' : 'text-gray-500 group-hover:text-gray-300'
                    }`}
                  >
                    {yg.total}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Quarter buttons (always 4, disabled when empty) */}
          {activeYearGroup && (
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
          )}
        </div>
      )}

      {yearGroups.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          No past projects yet.
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          {input
            ? `No projects in ${activeLabel} match your search.`
            : `No projects in ${activeLabel}.`}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 sm:gap-6">
          {visibleProjects.map((project, i) => (
            <ProjectCard
              key={`past-project-${selectedYear}-${selectedQuarter}-${project.id}-${i}`}
              project={project}
              projectContract={projectContract}
              hatsContract={hatsContract}
              isVotingPeriod={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
