import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import useJBProjectData from '../juicebox/useJBProjectData'

export default function useMissionData(
  mission: any,
  missionCreatorContract: any,
  jbControllerContract: any,
  jbTokensContract: any,
  projectMetadata?: any,
  projectSubgraphData?: any
) {
  const [fundingGoal, setFundingGoal] = useState(0)
  const [minFundingRequired, setMinFundingRequired] = useState(0)

  const jbProjectData = useJBProjectData(
    mission.projectId,
    jbControllerContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData
  )

  useEffect(() => {
    async function getFundingData() {
      const fundingGoal = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToFundingGoal' as string,
        params: [mission.id],
      })
      const minFundingRequired = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToMinFundingRequired' as string,
        params: [mission.id],
      })
      setFundingGoal(Number(fundingGoal))
      setMinFundingRequired(Number(minFundingRequired))
    }
    if (missionCreatorContract && mission.id !== undefined) {
      getFundingData()
    }
  }, [missionCreatorContract, mission.id])

  return { ...jbProjectData, fundingGoal, minFundingRequired }
}
