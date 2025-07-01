import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useEffect, useState } from 'react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import useJBProjectData from '../juicebox/useJBProjectData'

/*
1: Stage 1
2: Stage 2
3: Refund
*/
type MissionStage = 1 | 2 | 3

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
  const [backers, setBackers] = useState<any[]>([])
  const [deadline, setDeadline] = useState<number>(0)
  const [poolDeployerAddress, setPoolDeployerAddress] = useState<string>()

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
      setStage(+stage.toString() as MissionStage)
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getStage()
    }

    // Update the stage every minute
    const interval = setInterval(() => {
      getStage()
    }, 60000)

    return () => clearInterval(interval)
  }, [missionCreatorContract, mission?.id])

  useEffect(() => {
    async function getPoolDeployer() {
      const address: any = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPoolDeployer' as string,
        params: [mission.id],
      })
      setPoolDeployerAddress(address)
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getPoolDeployer()
    }
  }, [missionCreatorContract, mission?.id])

  useEffect(() => {
    async function getDeadline() {
      const payHookAddress: any = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [mission.id],
      })
      const payHookContract = getContract({
        client,
        address: payHookAddress,
        chain: DEFAULT_CHAIN_V5,
        abi: LaunchPadPayHookABI.abi as any,
      })
      const deadline: any = await readContract({
        contract: payHookContract,
        method: 'deadline' as string,
        params: [],
      })
      setDeadline(+deadline.toString() * 1000) // Convert to milliseconds
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getDeadline()
    }
  }, [missionCreatorContract, mission?.id])

  //Backers
  useEffect(() => {
    async function getBackers() {
      const res = await fetch(
        `/api/mission/backers?projectId=${mission?.projectId}`
      )
      const data = await res.json()
      setBackers(data.backers)
    }
    if (mission?.projectId !== undefined) {
      getBackers()
    }

    //Update backers every minute
    const interval = setInterval(() => {
      getBackers()
    }, 60000)

    return () => clearInterval(interval)
  }, [mission?.projectId])

  return {
    ...jbProjectData,
    fundingGoal,
    stage,
    backers,
    deadline,
    poolDeployerAddress,
  }
}
