/**
 * Batch Hat Operations
 *
 * Efficiently batch multiple hat-related contract calls using Engine API
 * to avoid sequential RPC calls when fetching team membership data
 */
import TeamABI from 'const/abis/Team.json'
import { TEAM_ADDRESSES } from 'const/config'
import { Chain, getContract } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

export type HatTeamData = {
  hatId: string
  teamId: string
  isAdminHat: boolean
}

/**
 * Batch fetch team IDs and admin status for multiple hats
 * Replaces sequential adminHatToTokenId and teamAdminHat calls
 */
export async function batchFetchHatTeamData(
  chain: Chain,
  hats: any[]
): Promise<Map<string, HatTeamData>> {
  const resultMap = new Map<string, HatTeamData>()

  if (!hats || hats.length === 0) {
    return resultMap
  }

  try {
    const chainSlug = getChainSlug(chain)
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
      chain,
    })

    const { engineMulticall } = await import('@/lib/thirdweb/engine')

    // Build all contract calls we need to make
    const contractCalls: any[] = []
    const callMetadata: Array<{ hatId: string; type: string; level: string }> = []

    // For each hat, traverse the admin chain to find team mappings.
    // Sub-hats (e.g. Executive Branch member, Overview member) may be 5+ levels deep.
    for (const hat of hats) {
      const adminIds = [
        hat.id,
        hat.admin?.id,
        hat.admin?.admin?.id,
        hat.admin?.admin?.admin?.id,
        hat.admin?.admin?.admin?.admin?.id,
      ].filter(Boolean)
      for (const adminId of adminIds) {
        contractCalls.push({
          contractAddress: teamContract.address,
          method: 'adminHatToTokenId',
          params: [adminId],
          abi: TeamABI,
        })
        callMetadata.push({ hatId: hat.id, type: 'adminHatToTokenId', level: 'admin' })
      }
    }

    // Execute all adminHatToTokenId calls in one batch
    const tokenIdResults = await engineMulticall<{ result: string }>(contractCalls, {
      chainId: chain.id,
    })

    // Process results: adminHatToTokenId is the source of truth - if it returns a team, the user is in that team
    const hatTeamMap = new Map<string, string>()
    tokenIdResults.forEach((result, index) => {
      const metadata = callMetadata[index]
      const teamId = BigInt(result.result).toString()

      if (teamId !== '0' && !hatTeamMap.has(metadata.hatId)) {
        hatTeamMap.set(metadata.hatId, teamId)
      }
    })

    // Map each hat to its team (first non-zero teamId we found in its admin chain)
    for (const hat of hats) {
      const teamId = hatTeamMap.get(hat.id)
      if (teamId && teamId !== '0') {
        resultMap.set(hat.id, {
          hatId: hat.id,
          teamId,
          isAdminHat: true,
        })
      }
    }

    return resultMap
  } catch (error) {
    console.error('Failed to batch fetch hat team data:', error)
    return resultMap
  }
}

/**
 * Process hats and add team IDs using batched contract calls
 * Replacement for sequential getTeamWearerServerSide logic
 */
export async function processHatsWithTeamData(chain: Chain, hats: any[]): Promise<any[]> {
  if (!hats || hats.length === 0) {
    return []
  }

  const hatTeamData = await batchFetchHatTeamData(chain, hats)

  return hats
    .map((hat) => {
      const teamData = hatTeamData.get(hat.id)
      if (teamData) {
        return {
          ...hat,
          teamId: teamData.teamId,
        }
      }
      return null
    })
    .filter((hat): hat is any => hat !== null)
}
