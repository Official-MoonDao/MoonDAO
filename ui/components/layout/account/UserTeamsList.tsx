'use client'

import { usePrivy } from '@privy-io/react-auth'
import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { loadTeamNames } from '@/lib/tableland/tableNft'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'

// Names that have already been read from the team table this session.
const teamNameCache = new Map<string, string>()

type UserTeamsListProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

/**
 * The teams the signed-in user wears a hat for.
 *
 * This was the Teams nav dropdown, which also carried Create a Team, Explore
 * Teams, Jobs and Marketplace — public destinations that now live in the
 * Network group. What is left is only the user's own teams, which is why it
 * sits in the account menu rather than in the public bar: `useTeamWearer` can
 * trigger an on-chain role-hat index scan, and a logged-out visitor should
 * never pay for one.
 */
export function UserTeamsList({ variant, onNavigate }: UserTeamsListProps) {
  const account = useActiveAccount()
  const { user } = usePrivy()
  const wearerAddresses = useMemo(
    () => getLinkedEvmAddresses(user, account?.address),
    [user, account?.address]
  )
  // Teams only exist on the deployment chain (Arbitrum / testnets), not on e.g. Ethereum
  // when the user picks another network in the wallet UI.
  const membershipChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(membershipChain)
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: membershipChain,
    abi: TeamABI as any,
  })
  const { userTeams, isLoading } = useTeamWearer(teamContract, membershipChain, wearerAddresses)

  const shouldShowLoading =
    wearerAddresses.length > 0 && (!teamContract || isLoading || userTeams === undefined)

  const isDesktop = variant === 'desktop'

  const baseLinkClass = isDesktop
    ? 'block px-4 py-2 text-sm transition-all duration-200 mx-2 rounded-lg text-gray-300 hover:text-white hover:bg-purple-500/20'
    : 'text-gray-300 hover:text-white my-3 flex items-center transition-colors duration-200'

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
        Loading your teams...
      </span>
    )
  }

  if (!userTeams || userTeams.length === 0) {
    return wrap(
      <Link href="/team" className={baseLinkClass} onClick={onNavigate}>
        No teams yet — create one
      </Link>
    )
  }

  return (
    <>
      {userTeams.map((team: any) =>
        wrap(
          <TeamNavItem teamId={team.teamId} baseClass={baseLinkClass} onNavigate={onNavigate} />,
          String(team.teamId)
        )
      )}
    </>
  )
}

function TeamNavItem({
  teamId,
  baseClass,
  onNavigate,
}: {
  teamId: string
  baseClass: string
  onNavigate?: () => void
}) {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    // teamId "0" is valid (Executive Branch); avoid `!teamId` which drops numeric 0.
    if (teamId == null || teamId === '' || (typeof teamId === 'number' && !Number.isFinite(teamId)))
      return

    const teamIdKey = String(teamId)
    const cachedName = teamNameCache.get(teamIdKey)
    if (cachedName) {
      setName(cachedName)
      return
    }

    let cancelled = false
    loadTeamNames(DEFAULT_CHAIN_V5, [teamIdKey])
      .then((names) => {
        if (cancelled) return
        const resolvedName = names.get(teamIdKey)
        if (resolvedName) teamNameCache.set(teamIdKey, resolvedName)
        setName(resolvedName || `Team #${teamIdKey}`)
      })
      .catch(() => {
        if (!cancelled) setName(`Team #${teamIdKey}`)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return (
    <Link href={`/team/${String(teamId)}`} className={baseClass} onClick={onNavigate}>
      {name || `Team #${teamId}`}
    </Link>
  )
}
