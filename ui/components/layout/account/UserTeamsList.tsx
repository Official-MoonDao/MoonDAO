'use client'

import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'

// Simple in-memory cache to avoid repeated getNFT calls per team
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
  const { userTeams, isLoading } = useTeamWearer(
    teamContract,
    membershipChain,
    wearerAddresses
  )

  const shouldShowLoading =
    wearerAddresses.length > 0 &&
    (!teamContract || isLoading || userTeams === undefined)

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
          <TeamNavItem
            teamContract={teamContract}
            teamId={team.teamId}
            baseClass={baseLinkClass}
            onNavigate={onNavigate}
          />,
          String(team.teamId)
        )
      )}
    </>
  )
}

function TeamNavItem({
  teamContract,
  teamId,
  baseClass,
  onNavigate,
}: {
  teamContract: any
  teamId: string
  baseClass: string
  onNavigate?: () => void
}) {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    // teamId "0" is valid (Executive Branch); avoid `!teamId` which drops numeric 0.
    if (
      !teamContract ||
      teamId == null ||
      teamId === '' ||
      (typeof teamId === 'number' && !Number.isFinite(teamId))
    )
      return

    const teamIdKey = String(teamId)

    // Use cached name if available to avoid repeated on-chain calls
    const cachedName = teamNameCache.get(teamIdKey)
    if (cachedName) {
      setName(cachedName)
      return
    }

    getNFT({
      contract: teamContract,
      tokenId: BigInt(teamIdKey),
    })
      .then((nft) => {
        const resolvedName =
          (nft?.metadata?.name as string | undefined) || `Team #${teamIdKey}`
        teamNameCache.set(teamIdKey, resolvedName)
        setName(resolvedName)
      })
      .catch(() => {
        const fallback = `Team #${teamIdKey}`
        teamNameCache.set(teamIdKey, fallback)
        setName(fallback)
      })
  }, [teamContract, teamId])

  return (
    <Link
      href={`/team/${String(teamId)}`}
      className={baseClass}
      onClick={onNavigate}
    >
      {name || `Team #${teamId}`}
    </Link>
  )
}
