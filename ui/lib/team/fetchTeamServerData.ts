import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import { getNFT } from 'thirdweb/extensions/erc721'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import { getChainSlug } from '../thirdweb/chain'
import { serverClient } from '../thirdweb/client'

export type TeamNFTData = {
  id: string
  metadata: any
  owner: string
  [key: string]: any
}

export type TeamDataWithHats = {
  teamNFT: TeamNFTData | null
  teamHats: any[]
}

/**
 * Fetch team NFT and associated hats from contracts
 */
export async function fetchTeamNFTAndHats(
  teamId: number | undefined,
  chain: Chain = DEFAULT_CHAIN_V5
): Promise<TeamDataWithHats> {
  if (teamId === undefined) {
    return { teamNFT: null, teamHats: [] }
  }

  try {
    const chainSlug = getChainSlug(chain)
    
    // Create team contract
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
      chain: chain,
    })

    // Fetch team NFT data
    const teamNFT = await getNFT({
      contract: teamContract,
      tokenId: BigInt(teamId),
    })

    if (!teamNFT) {
      return { teamNFT: null, teamHats: [] }
    }

    // Format team NFT
    const formattedTeamNFT = {
      ...teamNFT,
      id: teamNFT.id.toString(),
      metadata: { ...teamNFT.metadata, id: teamNFT.id.toString() },
    }

    // Fetch admin hat ID from team contract
    const adminHatId = await readContract({
      contract: teamContract,
      method: 'teamAdminHat' as string,
      params: [teamId],
    })

    let teamHats: any[] = []

    if (adminHatId) {
      // Fetch sub-hats using the hats subgraph client
      const hat = await hatsSubgraphClient.getHat({
        chainId: chain.id,
        hatId: adminHatId.toString(),
        props: {
          subHats: {
            props: {
              details: true,
              wearers: {
                props: {},
              },
              subHats: {
                props: {
                  details: true,
                  wearers: {
                    props: {},
                  },
                },
              },
            },
          },
        },
      })

      if (hat?.subHats) {
        const subHatsLevel1 = hat.subHats
        const subHatsLevel2 = subHatsLevel1?.map((hat: any) => hat.subHats).flat()
        teamHats = subHatsLevel1.concat(subHatsLevel2)
      }
    }

    return {
      teamNFT: formattedTeamNFT as any,
      teamHats,
    }
  } catch (error) {
    console.warn('Failed to fetch team data or hats:', error)
    return { teamNFT: null, teamHats: [] }
  }
}

