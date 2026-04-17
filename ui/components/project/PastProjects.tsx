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

type QuarterGroup = {
  key: string
  year: number
  quarter: number
  label: string
  projects: Project[]
}

export function hasFinalReport(p: Project): boolean {
  return Boolean(p.finalReportIPFS || p.finalReportLink)
}

function groupByQuarter(projects: Project[]): QuarterGroup[] {
  const groups = new Map<string, QuarterGroup>()
  for (const project of projects) {
    const year = Number(project.year) || 0
    const quarter = Number(project.quarter) || 0
    const key = `${year}-Q${quarter}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        year,
        quarter,
        label: `Q${quarter} ${year}`,
        projects: [],
      })
    }
    groups.get(key)!.projects.push(project)
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.quarter - a.quarter
  })
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

  // Group ALL final-report projects (so quarters reflect real data, not the search filter)
  const groups = useMemo(
    () => groupByQuarter(finalReportProjects),
    [finalReportProjects]
  )

  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    if (!groups.length) {
      setActiveKey(null)
      return
    }
    setActiveKey((prev) => {
      if (prev && groups.some((g) => g.key === prev)) return prev
      return groups[0].key
    })
  }, [groups])

  const activeGroup = useMemo(
    () => groups.find((g) => g.key === activeKey) || null,
    [groups, activeKey]
  )

  const visibleProjects = useMemo(() => {
    if (!activeGroup) return []
    const term = input.trim().toLowerCase()
    if (!term) return activeGroup.projects
    return activeGroup.projects.filter((p) =>
      p.name?.toString().toLowerCase().includes(term)
    )
  }, [activeGroup, input])

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
              activeGroup
                ? `Search ${activeGroup.label}...`
                : 'Search past projects...'
            }
          />
        </div>
      </div>

      {groups.length > 0 && (
        <div
          role="tablist"
          aria-label="Past project quarters"
          className="flex items-end gap-1 border-b border-white/10 overflow-x-auto"
        >
          {groups.map((group) => {
            const isActive = activeKey === group.key
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveKey(group.key)}
                className={`group relative px-3 sm:px-4 py-2 sm:py-2.5 -mb-px text-xs sm:text-sm font-RobotoMono uppercase tracking-wider whitespace-nowrap transition-colors rounded-t-lg border border-b-0 ${
                  isActive
                    ? 'bg-black/40 border-white/15 text-white'
                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{group.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] px-1.5 h-[18px] rounded-full text-[9px] sm:text-[10px] font-semibold ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                        : 'bg-white/5 text-gray-500 border border-white/10 group-hover:bg-white/10 group-hover:text-gray-300'
                    }`}
                  >
                    {group.projects.length}
                  </span>
                </span>
                {isActive && (
                  <span className="pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          No past projects yet.
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 py-10 text-center text-gray-400">
          {input
            ? `No projects in ${activeGroup?.label} match your search.`
            : 'No projects in this quarter.'}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 sm:gap-6">
          {visibleProjects.map((project, i) => (
            <ProjectCard
              key={`past-project-${activeKey}-${project.id}-${i}`}
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
