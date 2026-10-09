import ProjectABI from 'const/abis/Project.json'
import TeamABI from 'const/abis/Team.json'
import { PROJECT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { getAttribute } from '@/lib/utils/nft'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { ownerHref, parseOwnerId } from './projectOwnerId'

/**
 * Loads the team or project NFT behind a jobs/marketplace/mission `teamId`.
 * `ownerAddress` is the entity's Safe when `includeOwner` is set.
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
  const contract = owner?.kind === 'project' ? projectContract : teamContract || fallbackTeamContract

  const [nft, setNFT] = useState<any>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!owner || !contract) return
      try {
        const result = await getNFT({ contract, tokenId: BigInt(owner.id), includeOwner })
        if (!cancelled) setNFT(result)
      } catch (error) {
        console.error('Failed to load owner NFT:', error)
      }
    }
    setNFT(undefined)
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner?.kind, owner?.id, contract, includeOwner])

  const projectMDP =
    owner?.kind === 'project' ? getAttribute(nft?.metadata?.attributes, 'MDP')?.value : undefined

  return {
    owner,
    nft,
    name: nft?.metadata?.name as string | undefined,
    href: teamId === null || teamId === undefined ? undefined : ownerHref(teamId, { projectMDP }),
    ownerAddress: nft?.owner as string | undefined,
    contract,
  }
}
