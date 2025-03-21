import { useEffect, useState } from 'react'
import useJBProjectData from '../juicebox/useJBProjectData'

export default function useMissionData(
  projectId: number,
  missionTableContract: any,
  jbControllerContract: any,
  jbTokensContract: any,
  projectMetadata?: any,
  projectSubgraphData?: any
) {
  const [fundingGoal, setFundingGoal] = useState(0)
  const [minRequiredFunding, setMinRequiredFunding] = useState(0)

  const jbProjectData = useJBProjectData(
    projectId,
    jbControllerContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData
  )

  useEffect(() => {
    async function getMissionTableData() {
      const tableName = await readContract({
        contract: missionTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const statement = `SELECT * FROM ${tableName} WHERE projectId = ${projectId}`
      const missionTableData = await fetch(
        `/api/tableland/query?statement=${statement}`
      )
      const data = await missionTableData.json()
      setFundingGoal(data[0].fundingGoal)
      setMinRequiredFunding(data[0].minFundingRequired)
    }
    if (missionTableContract && projectId !== undefined) {
      getMissionTableData()
    }
  }, [missionTableContract, projectId])

  return { ...jbProjectData, fundingGoal, minRequiredFunding }
}
