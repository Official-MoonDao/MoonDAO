import ProjectABI from 'const/abis/Project.json'
import TeamABI from 'const/abis/Team.json'
import { PROJECT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { loadOwnerNft } from '@/lib/tableland/tableNft'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { getAttribute } from '@/lib/utils/nft'
import { ownerHref, parseOwnerId } from './projectOwnerId'

/**
 * Loads the team or project behind a jobs/marketplace/mission `teamId`.
 * Profile fields come from our tables. `ownerAddress` is the entity's Safe
 * when `includeOwner` is set.
 */
export default function useOwnerNFT(
  teamId: number | string | bigint | null | undefined,
  { includeOwner = false, teamContract }: { includeOwner?: boolean; teamContract?: any } = {}
) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const fallbackTeamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })
  const projectContract = useContract({
    chain: selectedChain,
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
  })

  const owner = teamId === null || teamId === undefined ? undefined : parseOwnerId(teamId)
  const contract =
    owner?.kind === 'project' ? projectContract : teamContract || fallbackTeamContract

  const [nft, setNFT] = useState<any>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (teamId === null || teamId === undefined || !owner) return
      // The chain owner is the purchase recipient. Read it even when the
      // table profile is missing or the query fails.
      let profile: any
      try {
        profile = (await loadOwnerNft(selectedChain, teamId)) || undefined
      } catch (error) {
        console.error('Failed to load owner profile:', error)
      }
      if (includeOwner && contract && owner) {
        try {
          const ownerAddress = await readContract({
            contract,
            method: 'ownerOf' as string,
            params: [BigInt(owner.id)],
          })
          if (profile) {
            profile.owner = ownerAddress
          } else if (ownerAddress) {
            profile = { owner: ownerAddress }
          }
        } catch (error) {
          console.error('Failed to read owner of', owner.kind, owner.id, error)
        }
      }
      if (!cancelled) setNFT(profile)
    }
    setNFT(undefined)
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, owner?.kind, owner?.id, selectedChain?.id, contract, includeOwner])

  const projectMDP =
    owner?.kind === 'project' ? getAttribute(nft?.metadata?.attributes, 'MDP')?.value : undefined

  return {
    owner,
    nft,
    name: (nft?.metadata?.name as string | undefined) || undefined,
    href: teamId === null || teamId === undefined ? undefined : ownerHref(teamId, { projectMDP }),
    // For a project, `href` is the `/projects` index when this trait is missing.
    // That string is truthy, so callers that have another MDP must read this field.
    projectMDP,
    ownerAddress: nft?.owner as string | undefined,
    contract,
  }
}
