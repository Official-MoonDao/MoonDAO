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
4: Goal is not met and refund stage has expired
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
  _stage,
  _deadline,
  _refundPeriod,
  _primaryTerminalAddress,
  _token,
  _fundingGoal,
  _ruleset,
  _backers,
}: any) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [fundingGoal, setFundingGoal] = useState(_fundingGoal)
  const [stage, setStage] = useState<MissionStage>(_stage)
  const [backers, setBackers] = useState<any[]>(_backers)
  const [deadline, setDeadline] = useState<number | undefined>(_deadline)
  const [refundPeriod, setRefundPeriod] = useState<number | undefined>(
    _refundPeriod
  )
  const [poolDeployerAddress, setPoolDeployerAddress] = useState<string>()

  const jbProjectData = useJBProjectData({
    projectId: mission?.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata,
    projectSubgraphData,
    _primaryTerminalAddress,
    _token,
    _ruleset,
    stage,
  })

  const refreshStage = useCallback(async () => {
    if (!missionCreatorContract || mission?.id === undefined) return

    if (mission.id === 'dummy') {
      setStage(_stage)
      return
    }

    try {
      const s: any = await readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [mission.id],
      })

      setStage(+s.toString() as MissionStage)
    } catch (error) {
      console.error('Error fetching stage for mission:', mission.id, error)
    }
  }, [missionCreatorContract, mission?.id])

  useEffect(() => {
    async function getFundingData() {
      const statement = `SELECT * FROM ${MISSION_TABLE_NAMES[chainSlug]} WHERE id = ${mission.id}`
      const res = await fetch(`/api/tableland/query?statement=${statement}`)
      const rows = await res.json()
      setFundingGoal(rows[0]?.fundingGoal)
    }
    if (mission?.id !== undefined && !fundingGoal) {
      getFundingData()
    }
  }, [chainSlug, mission?.id, _fundingGoal])

  useEffect(() => {
    if (missionCreatorContract && mission?.id !== undefined) {
      refreshStage()
    }

    // Update the stage every minute
    const interval = setInterval(() => {
      refreshStage()
    }, 60000)

    return () => clearInterval(interval)
  }, [refreshStage])

  useEffect(() => {
    async function getPoolDeployer() {
      try {
        const address: any = await readContract({
          contract: missionCreatorContract,
          method: 'missionIdToPoolDeployer' as string,
          params: [mission.id],
        })
        setPoolDeployerAddress(address)
      } catch (error) {
        console.error(
          'Error fetching pool deployer for mission:',
          mission.id,
          error
        )
        setPoolDeployerAddress(undefined)
      }
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getPoolDeployer()
    }
  }, [missionCreatorContract, mission?.id])

  useEffect(() => {
    async function getDeadline() {
      if (_deadline && _refundPeriod) {
        setDeadline(_deadline)
        setRefundPeriod(_refundPeriod)
        return
      }

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
        const refundPeriod: any = await readContract({
          contract: payHookContract,
          method: 'refundPeriod' as string,
          params: [],
        })
        setDeadline(+deadline.toString() * 1000) // Convert to milliseconds
        setRefundPeriod(+refundPeriod.toString() * 1000) // Convert to milliseconds
      }
    }
    if (missionCreatorContract && mission?.id !== undefined) {
      getDeadline()
    }
  }, [missionCreatorContract, mission?.id, _deadline, _refundPeriod])

  // Backers
  const refreshBackers = useCallback(async () => {
    if (mission?.projectId === undefined) return

    const res = await fetch(
      `/api/mission/backers?projectId=${mission?.projectId}`
    )
    const data = await res.json()
    setBackers(data.backers)
  }, [mission?.projectId])

  return {
    ...jbProjectData,
    fundingGoal,
    stage,
    backers,
    deadline,
    refundPeriod,
    poolDeployerAddress,
    refreshBackers,
    refreshStage,
  }
}
