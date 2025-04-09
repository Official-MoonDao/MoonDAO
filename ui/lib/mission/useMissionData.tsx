import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import useJBProjectData from '../juicebox/useJBProjectData'

/*
1: Stage 1
2: Stage 2
3: Stage 3
4: Refund
*/
type MissionStage = 1 | 2 | 3 | 4

export default function useMissionData({
  mission,
  missionTableContract,
  missionCreatorContract,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  projectMetadata,
  projectSubgraphData,
}: any) {
  const [fundingGoal, setFundingGoal] = useState(0)
  const [stage, setStage] = useState<MissionStage>()

  const jbProjectData = useJBProjectData({
    projectId: mission?.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData,
  })

  useEffect(() => {
    async function getFundingData() {
      const tableName = await readContract({
        contract: missionTableContract,
        method: 'getTableName' as string,
        params: [],
      })

      const statement = `SELECT * FROM ${tableName} WHERE id = ${mission.id}`
      const res = await fetch(`/api/tableland/query?statement=${statement}`)
      const rows = await res.json()
      setFundingGoal(rows[0]?.fundingGoal)
    }
    if (missionTableContract && mission?.id !== undefined) {
      getFundingData()
    }
  }, [missionTableContract, mission?.id])

  useEffect(() => {
    async function getStage() {
      const stage: any = await readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [mission.id],
      })
      console.log('stage', stage)
      setStage(+stage.toString() as MissionStage)
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getStage()
    }
  }, [missionCreatorContract, mission?.id])

  return { ...jbProjectData, fundingGoal, stage }
}
