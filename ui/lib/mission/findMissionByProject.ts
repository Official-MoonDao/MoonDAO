import MissionCreatorABI from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import { MISSION_CREATOR_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import { EXTRA_MISSION_CREATORS } from '@/lib/deprize/extraMissionCreators'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

const creatorAbi = ((MissionCreatorABI as any).abi ?? MissionCreatorABI) as any
const tableAbi = ((MissionTableABI as any).abi ?? MissionTableABI) as any

export type MissionProjectRow = {
  id: number
  teamId: number
  projectId: number
  fundingGoal: number
}

function creatorAddresses(chainSlug: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const address of [
    MISSION_CREATOR_ADDRESSES[chainSlug],
    ...(EXTRA_MISSION_CREATORS[chainSlug] ?? []),
  ]) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) continue
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(address)
  }
  return out
}

/**
 * Resolve a Juicebox project to its launchpad mission by reading MissionCreator,
 * including DePrize-only creators that are not in the app-wide mission table.
 */
export async function findMissionByJuiceboxProject(
  chain: Chain,
  projectId: number
): Promise<MissionProjectRow | null> {
  const chainSlug = getChainSlug(chain as any)

  const found = await Promise.all(
    creatorAddresses(chainSlug).map(async (address) => {
      try {
        const creator = getContract({
          client: serverClient,
          chain,
          address,
          abi: creatorAbi,
        })
        const tableAddr = await readContract({
          contract: creator,
          method: 'missionTable' as string,
          params: [],
        })
        if (typeof tableAddr !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(tableAddr)) return null
        if (/^0x0+$/.test(tableAddr)) return null

        const table = getContract({
          client: serverClient,
          chain,
          address: tableAddr,
          abi: tableAbi,
        })
        const curr = Number(
          await readContract({
            contract: table,
            method: 'currId' as string,
            params: [],
          })
        )
        if (!Number.isFinite(curr) || curr <= 1) return null

        const ids = Array.from({ length: Math.min(curr - 1, 200) }, (_, i) => i + 1)
        const projectIds = await Promise.all(
          ids.map((id) =>
            readContract({
              contract: creator,
              method: 'missionIdToProjectId' as string,
              params: [BigInt(id)],
            }).then((pid) => Number(pid))
          )
        )
        const missionId = ids[projectIds.indexOf(projectId)]
        if (!missionId) return null

        const teamId = Number(
          await readContract({
            contract: table,
            method: 'idToTeamId' as string,
            params: [BigInt(missionId)],
          })
        )
        return { id: missionId, teamId, projectId, fundingGoal: 0 }
      } catch {
        return null
      }
    })
  )

  return found.find((row) => row != null) ?? null
}
