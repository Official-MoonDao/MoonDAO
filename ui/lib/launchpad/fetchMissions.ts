import JBV5Controller from 'const/abis/JBV5Controller.json'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { Chain, getContract, readContract } from 'thirdweb'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { ChainType, Mission } from './types'

export async function fetchMissions(
  chain: ChainType,
  chainSlug: string,
  missionTableAddress: string,
  jbV5ControllerAddress: string
): Promise<Mission[]> {
  try {
    const missionTableContract = getContract({
      client: serverClient,
      address: missionTableAddress,
      abi: {} as any,
      chain: chain,
    })

    const missionTableName: any = await readContract({
      contract: missionTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const statement = `SELECT * FROM ${missionTableName}`
    const missionRows = await queryTable(chain, statement)

    const filteredMissionRows = missionRows.filter((mission: { id: string | number; [key: string]: unknown }) => {
      return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
    })

    const jbV5ControllerContract = getContract({
      client: serverClient,
      address: jbV5ControllerAddress,
      abi: JBV5Controller.abi as any,
      chain: chain,
    })

    const missions = await Promise.all(
      filteredMissionRows.map(async (missionRow: { id: string; teamId: string | null; projectId: string | null; fundingGoal?: number; [key: string]: unknown }, index: number) => {
        try {
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }

          if (!missionRow?.projectId) {
            return {
              id: missionRow?.id || `fallback-${index}`,
              teamId: missionRow?.teamId || null,
              projectId: null,
              metadata: {
                name: 'Mission Loading...',
                description: 'Mission data is being loaded.',
                image: '/assets/placeholder-mission.png',
              },
            }
          }

          const metadataURI = await readContract({
            contract: jbV5ControllerContract,
            method: 'uriOf' as string,
            params: [missionRow.projectId],
          })

          const metadataRes = await fetch(getIPFSGateway(metadataURI))
          const metadata = await metadataRes.json()

          return {
            id: missionRow.id,
            teamId: missionRow.teamId,
            projectId: missionRow.projectId,
            fundingGoal: missionRow.fundingGoal || 0,
            metadata: metadata,
          }
        } catch (error) {
          console.warn(`Failed to fetch mission ${missionRow?.id}:`, error)
          return {
            id: missionRow?.id || `fallback-${index}`,
            teamId: missionRow?.teamId || null,
            projectId: missionRow?.projectId || null,
            fundingGoal: missionRow?.fundingGoal || 0,
            metadata: {
              name: 'Mission Unavailable',
              description: 'This mission is temporarily unavailable.',
              image: '/assets/placeholder-mission.png',
            },
          }
        }
      })
    )

    return missions.filter((mission) => mission !== null)
  } catch (error) {
    console.error('Error in fetchMissions:', error)
    return []
  }
}

