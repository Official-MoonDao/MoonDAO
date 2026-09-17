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
import { proposalIdPrefix } from '@/lib/nance/constants'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { useUserProposals } from '@/lib/project/useUserProposals'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'

type UserProjectsListProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

/**
 * The signed-in user's projects and authored proposals.
 *
 * This was the Projects nav dropdown, which also carried Propose Project,
 * Explore Projects, Submit Contribution, Projects Overview and Proposal
 * Template — public destinations that now live in the Projects group or the
 * footer. Only the user's own work remains, so it belongs in the account menu.
 */
export function UserProjectsList({ variant, onNavigate }: UserProjectsListProps) {
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

  // Fetch user's authored proposals from Tableland (check all linked wallets)
  const { proposals: userProposals, isLoading: proposalsLoading } =
    useUserProposals(wearerAddresses)

  const isContractReady = !!projectContract && !!membershipChain
  const shouldShowLoading =
    wearerAddresses.length > 0 &&
    (!isContractReady || isLoading || projects === undefined || proposalsLoading)

  // Filter out proposals that already appear as projects (by MDP number)
  const projectMDPs = useMemo(() => {
    const set = new Set<number>()
    projects?.forEach((p: any) => {
      if (p.MDP != null) set.add(Number(p.MDP))
    })
    return set
  }, [projects])

  const extraProposals = useMemo(() => {
    if (!userProposals) return []
    return userProposals.filter((p) => {
      if (p.MDP == null) return true
      const mdp = Number(p.MDP)
      if (!Number.isFinite(mdp)) return true
      return !projectMDPs.has(mdp)
    })
  }, [userProposals, projectMDPs])

  const hasItems = (projects && projects.length > 0) || extraProposals.length > 0

  const isDesktop = variant === 'desktop'

  const baseLinkClass = isDesktop
    ? 'block px-4 py-2 text-sm transition-all duration-200 mx-2 rounded-lg text-gray-300 hover:text-white hover:bg-purple-500/20 overflow-hidden'
    : 'text-gray-300 hover:text-white my-3 flex items-center transition-colors duration-200 overflow-hidden'

  const wrap = (content: React.ReactNode, key?: string) =>
    isDesktop ? (
      <div key={key}>{content}</div>
    ) : (
      <li key={key} className="list-disc marker:text-white group">
        {content}
      </li>
    )

  if (shouldShowLoading) {
    return wrap(
      <span
        className={
          isDesktop
            ? 'block px-4 py-2 mx-2 text-gray-400 text-sm'
            : 'my-3 block text-gray-400 text-sm'
        }
      >
        Loading...
      </span>
    )
  }

  if (!hasItems) {
    return wrap(
      <Link href="/proposals" className={baseLinkClass} onClick={onNavigate}>
        No projects yet — propose one
      </Link>
    )
  }

  return (
    <>
      {projects?.map((proj: any) =>
        wrap(
          <ProjectNavItem
            projectId={proj.projectId}
            chainSlug={chainSlug}
            baseClass={baseLinkClass}
            onNavigate={onNavigate}
          />,
          `proj-${proj.projectId}`
        )
      )}
      {extraProposals.slice(0, 5).map((proposal) =>
        wrap(
          <Link
            href={`/project/${proposal.MDP}`}
            className={baseLinkClass}
            onClick={onNavigate}
          >
            <span className="truncate">
              {proposal.MDP ? `${proposalIdPrefix}${proposal.MDP} — ` : ''}
              {proposal.title}
            </span>
          </Link>,
          `prop-${proposal.MDP}`
        )
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
    <Link href={href} className={baseClass} onClick={onNavigate}>
      {name || `Project #${projectId}`}
    </Link>
  )
}
