import { useEffect, useState } from 'react'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { readContract, getContract } from 'thirdweb'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
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
      //console.log('missionCreatorContract', missionCreatorContract)
      if (!missionCreatorContract || mission?.id !== null) return
      const stage: any = await readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [mission.id],
      })
      console.log('Stage:', stage)
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
    async function getDeadline() {
      if (!missionCreatorContract || mission?.id !== null) return
      const payHookAddress: any = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [mission.id],
      })
      console.log('PayHook Address:', payHookAddress)
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
      console.log('Deadline:', deadline)
      setDeadline(+deadline.toString()) // Convert to milliseconds
      console.log('le Deadline:', new Date(+deadline.toString()))
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getDeadline()
    }
    const interval = setInterval(() => {
      getStage()
    }, 60000)

    return () => clearInterval(interval)
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
  //console.log('deadline', deadline)

  return { ...jbProjectData, fundingGoal, stage, backers, deadline }
}
