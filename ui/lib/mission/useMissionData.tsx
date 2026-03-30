import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import { DEFAULT_CHAIN_V5, MISSION_TABLE_NAMES } from 'const/config'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import useJBProjectData from '../juicebox/useJBProjectData'
import { useTablelandQuery } from '../swr/useTablelandQuery'
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
}: any) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [fundingGoal, setFundingGoal] = useState(_fundingGoal)
  const [stage, setStage] = useState<MissionStage>(_stage)
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

      let computedStage = +s.toString() as MissionStage

      // If MissionCreator returns stage 4 (closed), check whether the active
      // ruleset has a different dataHook (a manually-queued refund ruleset).
      // If so, read stage() from that hook — it may return 3 (refundable).
      if (computedStage === 4 && jbControllerContract && mission?.projectId) {
        try {
          const ruleset: any = await readContract({
            contract: jbControllerContract,
            method: 'currentRulesetOf' as string,
            params: [mission.projectId],
          })
          const activeDataHook = ruleset?.[1]?.dataHook
          const originalPayHook: any = await readContract({
            contract: missionCreatorContract,
            method: 'missionIdToPayHook' as string,
            params: [mission.id],
          }).catch(() => null)

          if (
            activeDataHook &&
            activeDataHook !== '0x0000000000000000000000000000000000000000' &&
            originalPayHook &&
            activeDataHook.toLowerCase() !== originalPayHook.toString().toLowerCase()
          ) {
            const activePayHookContract = getContract({
              client,
              address: activeDataHook,
              chain: selectedChain,
              abi: LaunchPadPayHookABI.abi as any,
            })
            // Need a terminal address for stage() — reuse _primaryTerminalAddress
            const terminalAddress = _primaryTerminalAddress || '0x0000000000000000000000000000000000000000'
            const activeStage: any = await readContract({
              contract: activePayHookContract,
              method: 'stage' as string,
              params: [terminalAddress, mission.projectId],
            })
            computedStage = +activeStage.toString() as MissionStage
          }
        } catch (err) {
          // ignore, keep computedStage = 4
        }
      }

      setStage(computedStage)
    } catch (error) {
      console.error('Error fetching stage for mission:', mission.id, error)
    }
  }, [missionCreatorContract, jbControllerContract, mission?.id, mission?.projectId, selectedChain, _primaryTerminalAddress])

  // Fetch funding goal from tableland
  const fundingStatement =
    mission?.id !== undefined && !fundingGoal
      ? `SELECT * FROM ${MISSION_TABLE_NAMES[chainSlug]} WHERE id = ${mission.id}`
      : null

  const { data: fundingData } = useTablelandQuery(fundingStatement, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (fundingData && fundingData[0]?.fundingGoal) {
      setFundingGoal(fundingData[0].fundingGoal)
    }
  }, [fundingData])

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

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      ...jbProjectData,
      fundingGoal,
      stage,
      deadline,
      refundPeriod,
      poolDeployerAddress,
      refreshStage,
    }),
    [
      jbProjectData,
      fundingGoal,
      stage,
      deadline,
      refundPeriod,
      poolDeployerAddress,
      refreshStage,
    ]
  )
}
