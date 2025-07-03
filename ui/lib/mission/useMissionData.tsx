import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import { DEFAULT_CHAIN_V5, MISSION_TABLE_NAMES } from 'const/config'
import { useCallback, useContext, useEffect, useState } from 'react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import useJBProjectData from '../juicebox/useJBProjectData'
import { getChainSlug } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'

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
  _stage,
  _deadline,
  _token,
}: any) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [fundingGoal, setFundingGoal] = useState(0)
  const [stage, setStage] = useState<MissionStage>(_stage)
  const [backers, setBackers] = useState<any[]>([])
  const [deadline, setDeadline] = useState<number | undefined>(_deadline)
  const [poolDeployerAddress, setPoolDeployerAddress] = useState<string>()

  const jbProjectData = useJBProjectData({
    projectId: mission?.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData,
    _token,
  })

  useEffect(() => {
    async function getFundingData() {
      const statement = `SELECT * FROM ${MISSION_TABLE_NAMES[chainSlug]} WHERE id = ${mission.id}`
      const res = await fetch(`/api/tableland/query?statement=${statement}`)
      const rows = await res.json()
      setFundingGoal(rows[0]?.fundingGoal)
    }
    if (mission?.id !== undefined) {
      getFundingData()
    }
  }, [mission?.id])

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
      if (payHookContract) {
        const deadline: any = await readContract({
          contract: payHookContract,
          method: 'deadline' as string,
          params: [],
        })
        setDeadline(+deadline.toString() * 1000) // Convert to milliseconds
      }
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getDeadline()
    }
  }, [missionCreatorContract, mission?.id])

  // Backers
  const refreshBackers = useCallback(async () => {
    if (mission?.projectId === undefined) return

    const res = await fetch(
      `/api/mission/backers?projectId=${mission?.projectId}`
    )
    const data = await res.json()
    setBackers(data.backers)
  }, [mission?.projectId])

  useEffect(() => {
    refreshBackers()

    //Update backers every minute
    const interval = setInterval(() => {
      refreshBackers()
    }, 60000)

    return () => clearInterval(interval)
  }, [refreshBackers])

  return {
    ...jbProjectData,
    fundingGoal,
    stage,
    backers,
    deadline,
    poolDeployerAddress,
    refreshBackers,
  }
}
