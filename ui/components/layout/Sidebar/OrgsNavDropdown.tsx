'use client'

import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import TeamABI from 'const/abis/Team.json'
import { TEAM_ADDRESSES } from 'const/config'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

type OrgsNavDropdownProps = {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export function OrgsNavDropdown({ variant, onNavigate }: OrgsNavDropdownProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = selectedChain ? getChainSlug(selectedChain) : 'arbitrum'
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: TeamABI as any,
  })
  const { userTeams: orgs, isLoading } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )

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
          Create an Org
        </Link>
      )}
      {wrapMobile(
        <Link href="/network?tab=orgs" className={baseLinkClass} onClick={onNavigate}>
          Explore Orgs
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
      {wrapMobile(
        <Link href="/launch" className={baseLinkClass} onClick={onNavigate}>
          Raise Funds (Launchpad)
        </Link>
      )}
      <div className={isDesktop ? 'pt-2' : ''}>
        <div className={`${isDesktop ? 'px-4 py-2 mx-2' : 'my-3'} text-xs text-gray-400 font-medium uppercase tracking-wider`}>
          Your Orgs
        </div>
        {isLoading ? (
          wrapMobile(
            <div className={`${isDesktop ? 'px-4 py-2 mx-2' : 'my-3'} text-gray-400 text-sm`}>
              Loading your orgs...
            </div>
          )
        ) : orgs && orgs.length > 0 ? (
          orgs.map((org: any) =>
            wrapMobile(
              <OrgNavItem
                key={org.teamId}
                teamContract={teamContract}
                teamId={org.teamId}
                baseClass={baseLinkClass}
                isDesktop={isDesktop}
                onNavigate={onNavigate}
              />
            )
          )
        ) : (
          wrapMobile(
            <Link href="/join" className={baseLinkClass} onClick={onNavigate}>
              No orgs yet — create one
            </Link>
          )
        )}
      </div>
    </>
  )
}

function OrgNavItem({
  teamContract,
  teamId,
  baseClass,
  isDesktop,
  onNavigate,
}: {
  teamContract: any
  teamId: string
  baseClass: string
  isDesktop: boolean
  onNavigate?: () => void
}) {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    if (!teamContract || !teamId) return
    getNFT({
      contract: teamContract,
      tokenId: BigInt(teamId),
    })
      .then((nft) => setName(nft?.metadata?.name as string || `Org #${teamId}`))
      .catch(() => setName(`Org #${teamId}`))
  }, [teamContract, teamId])

  return (
    <Link
      href={`/org/${teamId}`}
      className={baseClass}
      onClick={onNavigate}
    >
      {name || `Org #${teamId}`}
    </Link>
  )
}
