'use client'

import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getMoonDAODataChain, getMoonDAODataChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

// Simple in-memory cache to avoid repeated getNFT calls per team
const teamNameCache = new Map<string, string>()

type TeamsNavDropdownProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
  prefetchedTeams?: any[]
  prefetchedLoading?: boolean
}

export function TeamsNavDropdown({
  variant,
  onNavigate,
  prefetchedTeams,
  prefetchedLoading,
}: TeamsNavDropdownProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const resolvedChain = getMoonDAODataChain(selectedChain)
  const chainSlug = getMoonDAODataChainSlug(selectedChain)
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: resolvedChain,
    abi: TeamABI as any,
  })
  const { userTeams: internalTeams, isLoading: internalLoading } = useTeamWearer(
    teamContract,
    resolvedChain,
    address
  )

  const hasPrefetched = prefetchedTeams !== undefined
  const userTeams = hasPrefetched ? prefetchedTeams : internalTeams
  const isLoading = hasPrefetched ? !!prefetchedLoading : internalLoading

  const shouldShowLoading = !!address && isLoading

  const isDesktop = variant === 'desktop'

  const baseLinkClass = isDesktop
    ? 'block px-4 py-2 text-sm transition-all duration-200 mx-2 rounded-lg text-gray-300 hover:text-white hover:bg-purple-500/20'
    : 'text-gray-300 hover:text-white my-3 flex items-center transition-colors duration-200'

  const wrapMobile = (content: React.ReactNode) =>
    isDesktop ? content : <li className="list-disc marker:text-white group">{content}</li>

  return (
    <>
      {wrapMobile(
        <Link href="/join" className={baseLinkClass} onClick={onNavigate}>
          Create a Team
        </Link>
      )}
      {wrapMobile(
        <Link href="/network?tab=teams" className={baseLinkClass} onClick={onNavigate}>
          Explore Teams
        </Link>
      )}
      {wrapMobile(
        <Link href="/jobs" className={baseLinkClass} onClick={onNavigate}>
          Jobs
        </Link>
      )}
      {wrapMobile(
        <Link href="/marketplace" className={baseLinkClass} onClick={onNavigate}>
          Marketplace
        </Link>
      )}
      {isDesktop ? (
        <div className="pt-2">
          <div className="px-4 py-2 mx-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
            Your Teams
          </div>
          {shouldShowLoading ? (
            wrapMobile(
              <div className="px-4 py-2 mx-2 text-gray-400 text-sm">
                Loading your teams...
              </div>
            )
          ) : userTeams && userTeams.length > 0 ? (
            userTeams.map((team: any) =>
              wrapMobile(
                <TeamNavItem
                  key={team.teamId}
                  teamContract={teamContract}
                  teamId={team.teamId}
                  teamName={team.name}
                  baseClass={baseLinkClass}
                  onNavigate={onNavigate}
                />
              )
            )
          ) : (
            wrapMobile(
              <Link href="/join" className={baseLinkClass} onClick={onNavigate}>
                No teams yet — create one
              </Link>
            )
          )}
        </div>
      ) : (
        <>
          {wrapMobile(
            <div className="my-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
              Your Teams
            </div>
          )}
          {shouldShowLoading ? (
            wrapMobile(
              <div className="my-3 text-gray-400 text-sm">
                Loading your teams...
              </div>
            )
          ) : userTeams && userTeams.length > 0 ? (
            userTeams.map((team: any) =>
              wrapMobile(
                <TeamNavItem
                  key={team.teamId}
                  teamContract={teamContract}
                  teamId={team.teamId}
                  teamName={team.name}
                  baseClass={baseLinkClass}
                  onNavigate={onNavigate}
                />
              )
            )
          ) : (
            wrapMobile(
              <Link href="/join" className={baseLinkClass} onClick={onNavigate}>
                No teams yet — create one
              </Link>
            )
          )}
        </>
      )}
    </>
  )
}

function TeamNavItem({
  teamContract,
  teamId,
  teamName,
  baseClass,
  onNavigate,
}: {
  teamContract: any
  teamId: string
  teamName?: string | null
  baseClass: string
  onNavigate?: () => void
}) {
  const [fetchedName, setFetchedName] = useState<string | null>(null)

  useEffect(() => {
    if (teamName) return
    if (!teamContract || !teamId) return

    const cachedName = teamNameCache.get(teamId)
    if (cachedName) {
      setFetchedName(cachedName)
      return
    }

    getNFT({
      contract: teamContract,
      tokenId: BigInt(teamId),
    })
      .then((nft) => {
        const resolvedName =
          (nft?.metadata?.name as string | undefined) || `Team #${teamId}`
        teamNameCache.set(teamId, resolvedName)
        setFetchedName(resolvedName)
      })
      .catch(() => {
        const fallback = `Team #${teamId}`
        teamNameCache.set(teamId, fallback)
        setFetchedName(fallback)
      })
  }, [teamName, teamContract, teamId])

  const displayName = teamName || fetchedName || `Team #${teamId}`

  return (
    <Link
      href={`/team/${teamId}`}
      className={baseClass}
      onClick={onNavigate}
    >
      {displayName}
    </Link>
  )
}
