import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import useJBProjectData from '../juicebox/useJBProjectData'

export default function useMissionData(
  mission: any,
  missionTableContract: any,
  jbControllerContract: any,
  jbDirectoryContract: any,
  jbTokensContract: any,
  projectMetadata?: any,
  projectSubgraphData?: any
) {
  const [fundingGoal, setFundingGoal] = useState(0)

  const jbProjectData = useJBProjectData(
    mission.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData
  )

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
      setFundingGoal(rows[0].fundingGoal)
    }
    if (missionTableContract && mission?.id !== undefined) {
      getFundingData()
    }
  }, [missionTableContract, mission.id])

  return { ...jbProjectData, fundingGoal }
}
