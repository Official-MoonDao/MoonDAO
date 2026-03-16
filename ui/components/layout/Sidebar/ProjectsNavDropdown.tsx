'use client'

import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_ADDRESSES, PROJECT_TABLE_NAMES } from 'const/config'
import { useProjectWearer } from '@/lib/hats/useProjectWearer'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

type ProjectsNavDropdownProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export function ProjectsNavDropdown({
  variant,
  onNavigate,
}: ProjectsNavDropdownProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = selectedChain ? getChainSlug(selectedChain) : 'arbitrum'
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: ProjectABI as any,
  })
  const { userProjects: projects, isLoading } = useProjectWearer(
    projectContract,
    selectedChain,
    address
  )

  const isContractReady = !!projectContract && !!selectedChain
  const shouldShowLoading =
    !!address && (!isContractReady || isLoading || projects === undefined)

  const isDesktop = variant === 'desktop'

  const baseLinkClass = isDesktop
    ? 'block px-4 py-2 text-sm transition-all duration-200 mx-2 rounded-lg text-gray-300 hover:text-white hover:bg-purple-500/20'
    : 'text-gray-300 hover:text-white my-3 flex items-center transition-colors duration-200'

  const wrapMobile = (content: React.ReactNode) =>
    isDesktop ? content : <li className="list-disc marker:text-white group">{content}</li>

  return (
    <>
      {wrapMobile(
        <Link
          href="/proposals"
          className={baseLinkClass}
          onClick={onNavigate}
        >
          Propose Project
        </Link>
      )}
      {wrapMobile(
        <Link href="/projects" className={baseLinkClass} onClick={onNavigate}>
          Explore Projects
        </Link>
      )}
      {wrapMobile(
        <Link href="/contributions" className={baseLinkClass} onClick={onNavigate}>
          Submit Contribution
        </Link>
      )}
      {wrapMobile(
        <Link href="/projects-overview" className={baseLinkClass} onClick={onNavigate}>
          Projects Overview
        </Link>
      )}
      {isDesktop ? (
        <div className="pt-2">
          <div className="px-4 py-2 mx-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
            Your Projects
          </div>
          {shouldShowLoading ? (
            wrapMobile(
              <div className="px-4 py-2 mx-2 text-gray-400 text-sm">
                Loading your projects...
              </div>
            )
          ) : projects && projects.length > 0 ? (
            projects.map((proj: any) =>
              wrapMobile(
                <ProjectNavItem
                  key={proj.projectId}
                  projectId={proj.projectId}
                  chainSlug={chainSlug}
                  baseClass={baseLinkClass}
                  onNavigate={onNavigate}
                />
              )
            )
          ) : (
            wrapMobile(
              <Link href="/proposals" className={baseLinkClass} onClick={onNavigate}>
                No projects yet — propose one
              </Link>
            )
          )}
        </div>
      ) : (
        <>
          <li className="my-3 text-xs text-gray-400 font-medium uppercase tracking-wider list-none">
            Your Projects
          </li>
          {shouldShowLoading ? (
            <li className="list-disc marker:text-white group my-3 text-gray-400 text-sm">
              Loading your projects...
            </li>
          ) : projects && projects.length > 0 ? (
            projects.map((proj: any) =>
              wrapMobile(
                <ProjectNavItem
                  key={proj.projectId}
                  projectId={proj.projectId}
                  chainSlug={chainSlug}
                  baseClass={baseLinkClass}
                  onNavigate={onNavigate}
                />
              )
            )
          ) : (
            wrapMobile(
              <Link href="/proposals" className={baseLinkClass} onClick={onNavigate}>
                No projects yet — propose one
              </Link>
            )
          )}
        </>
      )}
    </>
  )
}

function ProjectNavItem({
  projectId,
  chainSlug,
  baseClass,
  onNavigate,
}: {
  projectId: string
  chainSlug: string
  baseClass: string
  onNavigate?: () => void
}) {
  const [name, setName] = useState<string | null>(null)
  const tableName = PROJECT_TABLE_NAMES[chainSlug]
  const numericId = parseInt(projectId, 10)
  const statement =
    tableName && !isNaN(numericId)
      ? `SELECT name FROM ${tableName} WHERE id = ${numericId} OR MDP = ${numericId} LIMIT 1`
      : null
  const { data: rows } = useTablelandQuery(statement)

  useEffect(() => {
    if (rows && rows[0]) {
      setName((rows[0] as any).name || `Project #${projectId}`)
    }
  }, [rows, projectId])

  return (
    <Link
      href={`/project/${projectId}`}
      className={baseClass}
      onClick={onNavigate}
    >
      {name || `Project #${projectId}`}
    </Link>
  )
}
