import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_ADDRESSES, PROJECT_TABLE_NAMES } from 'const/config'
import { useProjectWearer } from '@/lib/hats/useProjectWearer'
import { proposalIdPrefix } from '@/lib/nance/constants'
import { PROJECT_ACTIVE, PROJECT_ENDED, PROJECT_PENDING } from '@/lib/nance/types'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'

type CitizenProjectsProps = {
  ownerAddress: string
}

function projectStatusLabel(active: number): string {
  if (active === PROJECT_ACTIVE) return 'Active'
  if (active === PROJECT_PENDING) return 'Pending'
  if (active === PROJECT_ENDED) return 'Completed'
  return 'Past'
}

function projectStatusClass(active: number): string {
  if (active === PROJECT_ACTIVE) {
    return 'bg-green-500/15 text-green-300 border-green-400/30'
  }
  if (active === PROJECT_PENDING) {
    return 'bg-yellow-500/15 text-yellow-300 border-yellow-400/30'
  }
  return 'bg-slate-500/15 text-slate-300 border-slate-400/30'
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year)
    if (yearDiff !== 0) return yearDiff
    const quarterDiff = Number(b.quarter) - Number(a.quarter)
    if (quarterDiff !== 0) return quarterDiff
    return Number(b.id) - Number(a.id)
  })
}

export default function CitizenProjects({ ownerAddress }: CitizenProjectsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: selectedChain,
  })

  const { userProjects, isLoading: isLoadingHats } = useProjectWearer(
    projectContract,
    selectedChain,
    ownerAddress
  )

  const projectIds = useMemo(() => {
    if (!userProjects?.length) return []
    return userProjects
      .map((entry: { projectId: string }) => Number(entry.projectId))
      .filter((id: number) => Number.isFinite(id) && id > 0)
  }, [userProjects])

  const statement = useMemo(() => {
    if (!projectIds.length) return null
    const tableName = PROJECT_TABLE_NAMES[chainSlug]
    if (!tableName) return null
    return `SELECT * FROM ${tableName} WHERE id IN (${projectIds.join(',')})`
  }, [projectIds, chainSlug])

  const { data: rows, isLoading: isLoadingRows } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  const [resolvedNames, setResolvedNames] = useState<Record<number, string>>({})

  const projects = useMemo(() => {
    if (!rows?.length) return []
    return sortProjects(rows as Project[])
  }, [rows])

  useEffect(() => {
    if (!projects.length) return

    let cancelled = false
    ;(async () => {
      const updates: Record<number, string> = {}
      await Promise.allSettled(
        projects.map(async (project) => {
          const stored = getProjectDisplayName(project)
          if (stored !== 'Untitled Project' || !project.proposalIPFS) return
          try {
            const res = await fetch(project.proposalIPFS)
            const json = await res.json()
            const resolved = getProjectDisplayName(project, json)
            if (resolved !== 'Untitled Project') {
              updates[project.id] = resolved
            }
          } catch {
            // Keep stored name
          }
        })
      )
      if (!cancelled && Object.keys(updates).length > 0) {
        setResolvedNames((prev) => ({ ...prev, ...updates }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projects])

  const isLoading =
    isLoadingHats ||
    (projectIds.length > 0 && (isLoadingRows || rows === undefined))

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
        <h2 className="font-GoodTimes text-2xl text-white mb-6">Projects</h2>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`project-skeleton-${i}`}
              className="h-16 rounded-xl bg-slate-700/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!projects.length) {
    return null
  }

  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h2 className="font-GoodTimes text-2xl text-white">Projects</h2>
        <p className="text-sm text-slate-400">
          On-chain proof of work across {projects.length} project
          {projects.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {projects.map((project) => {
          const displayName =
            resolvedNames[project.id] ?? getProjectDisplayName(project)
          const href = project.MDP ? `/project/${project.MDP}` : `/project/${project.id}`
          const quarterLabel =
            project.year && project.quarter
              ? `Q${project.quarter} ${project.year}`
              : null

          return (
            <Link
              key={`citizen-project-${project.id}`}
              href={href}
              className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors border border-slate-500/20 hover:border-slate-400/30"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-GoodTimes text-white text-lg truncate">
                    {project.MDP
                      ? `${proposalIdPrefix}${project.MDP}: ${displayName}`
                      : displayName}
                  </p>
                  {quarterLabel && (
                    <p className="text-sm text-slate-400 mt-1">{quarterLabel}</p>
                  )}
                </div>
                <span
                  className={`inline-flex self-start sm:self-center shrink-0 items-center px-2.5 py-1 rounded-md text-xs font-RobotoMono uppercase tracking-wide border ${projectStatusClass(
                    project.active
                  )}`}
                >
                  {projectStatusLabel(project.active)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
