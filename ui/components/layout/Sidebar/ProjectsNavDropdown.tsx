'use client'

import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import ProjectABI from 'const/abis/Project.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_ADDRESSES,
  PROJECT_TABLE_NAMES,
} from 'const/config'
import { useProjectWearer } from '@/lib/hats/useProjectWearer'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
type ProjectsNavDropdownProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export function ProjectsNavDropdown({
  variant,
  onNavigate,
}: ProjectsNavDropdownProps) {
  const account = useActiveAccount()
  const { user } = usePrivy()
  const wearerAddresses = useMemo(
    () => getLinkedEvmAddresses(user, account?.address),
    [user, account?.address]
  )
  const membershipChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(membershipChain)
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    chain: membershipChain,
    abi: ProjectABI as any,
  })
  const { userProjects: projects, isLoading } = useProjectWearer(
    projectContract,
    membershipChain,
    wearerAddresses
  )

  const isContractReady = !!projectContract && !!membershipChain
  const shouldShowLoading =
    wearerAddresses.length > 0 &&
    (!isContractReady || isLoading || projects === undefined)

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
  const [mdp, setMdp] = useState<string | null>(null)
  const tableName = PROJECT_TABLE_NAMES[chainSlug]
  const numericId = parseInt(projectId, 10)
  const statement =
    tableName && !isNaN(numericId)
      ? `SELECT name, MDP FROM ${tableName} WHERE id = ${numericId} LIMIT 1`
      : null
  const { data: rows } = useTablelandQuery(statement)

  useEffect(() => {
    if (rows && rows[0]) {
      const row = rows[0] as any
      setName(row.name || `Project #${projectId}`)
      if (row.MDP != null) {
        setMdp(String(row.MDP))
      }
    }
  }, [rows, projectId])

  const href = mdp ? `/project/${mdp}` : `/project/${projectId}`

  return (
    <Link
      href={href}
      className={baseClass}
      onClick={onNavigate}
    >
      {name || `Project #${projectId}`}
    </Link>
  )
}
