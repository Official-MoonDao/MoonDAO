import { DEFAULT_CHAIN_V5, JBV5_CONTROLLER_ADDRESS, MISSION_TABLE_ADDRESSES } from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { getContract, readContract } from 'thirdweb'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

export default async function getHomeStaticProps() {
  // Lightweight homepage - only fetch mission data
  // Import ABIs only on server-side
  const JBV5Controller = (await import('const/abis/JBV5Controller.json')).default
  const MissionTableABI = (await import('const/abis/MissionTable.json')).default

  let missions: any = []
  let featuredMissionData: any = null

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: MissionTableABI as any,
    })

    const missionTableName = await readContract({
      contract: missionTableContract,
      method: 'getTableName',
    })

    const missionRows = await queryTable(
      chain,
      `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 1`
    )

    // Process missions data
    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })

      // Only fetch metadata for the first mission
      if (filteredMissionRows.length > 0 && filteredMissionRows[0]?.projectId) {
        try {
          const jbV5ControllerContract = getContract({
            client: serverClient,
            address: JBV5_CONTROLLER_ADDRESS,
            abi: JBV5Controller.abi as any,
            chain: chain,
          })

          const metadataURI = await readContract({
            contract: jbV5ControllerContract,
            method: 'uriOf' as string,
            params: [filteredMissionRows[0].projectId],
          })

          const metadataRes = await fetch(getIPFSGateway(metadataURI))
          const metadata = await metadataRes.json()

          missions = [
            {
              id: filteredMissionRows[0].id,
              teamId: filteredMissionRows[0].teamId,
              projectId: filteredMissionRows[0].projectId,
              fundingGoal: filteredMissionRows[0].fundingGoal || 0,
              deadline: filteredMissionRows[0].deadline || null,
              stage: filteredMissionRows[0].stage || 1,
              metadata: metadata,
            },
          ]

          // Pass basic featured mission data - let client fetch details
          featuredMissionData = {
            mission: missions[0],
            projectMetadata: metadata,
          }
        } catch (error) {
          console.warn('Failed to fetch featured mission metadata:', error)
          // Fallback to basic data without metadata
          missions = [
            {
              id: filteredMissionRows[0].id,
              teamId: filteredMissionRows[0].teamId,
              projectId: filteredMissionRows[0].projectId,
              fundingGoal: filteredMissionRows[0].fundingGoal || 0,
              deadline: filteredMissionRows[0].deadline || null,
              stage: filteredMissionRows[0].stage || 1,
              metadata: {
                name: 'Featured Mission',
                description: 'Loading mission details...',
                image: '/assets/placeholder-mission.png',
              },
            },
          ]
        }
      }
    }
  } catch (error) {
    console.error('Mission data fetch failed:', error)
  }

  return {
    props: {
      missions,
      featuredMissionData,
    },
    revalidate: 300, // 5 minutes
  }
}
