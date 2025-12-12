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

    // For each hat, we need to check:
    // 1. adminHatToTokenId for the hat itself
    // 2. adminHatToTokenId for hat.admin
    // 3. adminHatToTokenId for hat.admin.admin (if exists)
    for (const hat of hats) {
      // Check hat itself
      contractCalls.push({
        contractAddress: teamContract.address,
        method: 'adminHatToTokenId',
        params: [hat.id],
        abi: TeamABI,
      })
      callMetadata.push({ hatId: hat.id, type: 'adminHatToTokenId', level: 'self' })

      // Check admin
      if (hat.admin?.id) {
        contractCalls.push({
          contractAddress: teamContract.address,
          method: 'adminHatToTokenId',
          params: [hat.admin.id],
          abi: TeamABI,
        })
        callMetadata.push({ hatId: hat.id, type: 'adminHatToTokenId', level: 'admin' })
      }

      // Check admin.admin
      if (hat.admin?.admin?.id) {
        contractCalls.push({
          contractAddress: teamContract.address,
          method: 'adminHatToTokenId',
          params: [hat.admin.admin.id],
          abi: TeamABI,
        })
        callMetadata.push({ hatId: hat.id, type: 'adminHatToTokenId', level: 'adminAdmin' })
      }
    }

    // Execute all adminHatToTokenId calls in one batch
    const tokenIdResults = await engineMulticall<{ result: string }>(contractCalls, {
      chainId: chain.id,
    })

    // Process results to find which hat belongs to which team
    const hatTeamMap = new Map<string, string>()
    tokenIdResults.forEach((result, index) => {
      const metadata = callMetadata[index]
      const teamId = BigInt(result.result).toString()

      if (teamId !== '0' && !hatTeamMap.has(metadata.hatId)) {
        hatTeamMap.set(metadata.hatId, teamId)
      }
    })

    // Now fetch teamAdminHat for each unique teamId we found
    const uniqueTeamIds = Array.from(new Set(hatTeamMap.values())).filter((id) => id !== '0')

    if (uniqueTeamIds.length > 0) {
      const adminHatCalls = uniqueTeamIds.map((teamId) => ({
        contractAddress: teamContract.address,
        method: 'teamAdminHat',
        params: [teamId],
        abi: TeamABI,
      }))

      const adminHatResults = await engineMulticall<{ result: string }>(adminHatCalls, {
        chainId: chain.id,
      })

      const teamAdminHatMap = new Map<string, string>()
      adminHatResults.forEach((result, index) => {
        const teamId = uniqueTeamIds[index]
        const adminHatId = result.result
        teamAdminHatMap.set(teamId, adminHatId)
      })

      // Build final result map
      for (const hat of hats) {
        const teamId = hatTeamMap.get(hat.id)
        if (teamId && teamId !== '0') {
          const adminHatId = teamAdminHatMap.get(teamId)
          const isAdminHat =
            hat.id === adminHatId ||
            hat.admin?.id === adminHatId ||
            hat.admin?.admin?.id === adminHatId ||
            hat.admin?.admin?.admin?.id === adminHatId

          if (isAdminHat) {
            resultMap.set(hat.id, {
              hatId: hat.id,
              teamId,
              isAdminHat: true,
            })
          }
        }
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
