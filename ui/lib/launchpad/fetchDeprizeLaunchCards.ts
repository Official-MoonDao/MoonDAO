import JBV5Controller from 'const/abis/JBV5Controller.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import { JBV5_CONTROLLER_ADDRESS } from 'const/config'
import { Chain, getContract, readContract } from 'thirdweb'
import { EXTRA_MISSION_CREATORS } from '@/lib/deprize/extraMissionCreators'
import {
  deprizeLaunchCards,
  type DeprizeLaunchCard,
  type DeprizeLaunchRow,
} from '@/lib/launchpad/deprizeLaunchCards'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

/**
 * Prize cards from the DePrize-only mission table. The public launch table
 * does not include these projects.
 */
export async function fetchDeprizeLaunchCards(chain: Chain): Promise<DeprizeLaunchCard[]> {
  const creatorAddress = EXTRA_MISSION_CREATORS[getChainSlug(chain)]?.[0]
  if (!creatorAddress) return []

  const creator = getContract({
    client: serverClient,
    address: creatorAddress,
    abi: (MissionCreator as any).abi ?? MissionCreator,
    chain,
  })
  const tableAddress = await readContract({
    contract: creator,
    method: 'missionTable' as string,
    params: [],
  })
  if (typeof tableAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(tableAddress)) return []

  const table = getContract({
    client: serverClient,
    address: tableAddress,
    abi: MissionTableABI as any,
    chain,
  })
  const tableName = await readContract({
    contract: table,
    method: 'getTableName' as string,
    params: [],
  })
  if (typeof tableName !== 'string' || !tableName) return []

  const missionRows = await queryTable(chain as any, `SELECT id, projectId FROM ${tableName}`)
  const controller = getContract({
    client: serverClient,
    address: JBV5_CONTROLLER_ADDRESS,
    abi: (JBV5Controller as any).abi ?? JBV5Controller,
    chain,
  })

  const rows = (
    await Promise.all(
      (missionRows ?? []).map(async (mission: { id?: unknown; projectId?: unknown }) => {
        const id = Number(mission?.id)
        const projectId = Number(mission?.projectId)
        if (!Number.isInteger(id) || !Number.isInteger(projectId) || projectId <= 0) return null
        let uri = ''
        try {
          uri = String(
            await readContract({
              contract: controller,
              method: 'uriOf' as string,
              params: [projectId],
            })
          )
        } catch {
          uri = ''
        }
        return { id, projectId, uri }
      })
    )
  ).filter((row): row is DeprizeLaunchRow => row !== null)
  return deprizeLaunchCards(rows)
}
