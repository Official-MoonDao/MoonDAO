import JBV5Controller from 'const/abis/JBV5Controller.json'
import LaunchPadPayHook from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import {
  JBV5_CONTROLLER_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
} from 'const/config'
import { useContext } from 'react'
import { getChainSlug } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'
import useRead from '../thirdweb/hooks/useRead'
import {
  extractActiveDataHook,
  isZeroAddress,
} from './extractActiveDataHook'

/**
 * Returns the current funding stage for a mission.
 *
 * `MissionCreator.stage()` reads the PayHook recorded at creation time
 * (`missionIdToPayHook`). After a re-open, the active ruleset's `dataHook` is a
 * new hook with a fresh deadline, and the original hook reports a stale "closed"
 * stage. Older deployed MissionCreators have no setter to update that pointer, so
 * we read the stage from the active ruleset's dataHook when it differs from the
 * original PayHook — mirroring the server-side logic in fetchMissionContracts.
 * Falls back to `MissionCreator.stage()` when no re-open ruleset is live (or when
 * projectId/terminal are unavailable).
 */
export default function useMissionFundingStage(
  missionId: number | string | undefined,
  projectId?: number | undefined,
  primaryTerminalAddress?: string | undefined
) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  // The E2E-only `/mission/dummy` page passes id 'dummy' — skip every live
  // read so its rendered stage stays exactly what SSR provided instead of
  // racing real contract state. Numeric strings (tableland rows) still work.
  const numericMissionId =
    typeof missionId === 'number'
      ? missionId
      : typeof missionId === 'string' && /^\d+$/.test(missionId)
      ? Number(missionId)
      : undefined

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi,
    chain: selectedChain,
  })

  const jbControllerContract = useContract({
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi,
    chain: selectedChain,
  })

  // PayHook recorded at creation time (stale after a re-open).
  const { data: originalPayHook } = useRead({
    contract: missionCreatorContract,
    method: 'missionIdToPayHook',
    params: [numericMissionId],
    deps: [numericMissionId],
  })

  // Active ruleset — its dataHook is the live (possibly re-open) hook.
  const { data: ruleset } = useRead({
    contract: jbControllerContract,
    method: 'currentRulesetOf',
    params: [projectId],
    deps: [projectId],
  })

  const activeDataHook = extractActiveDataHook(ruleset)

  // Prefer the active ruleset dataHook whenever it differs from the creation-time
  // PayHook — including when the creation-time mapping is missing/0x0 (Frank).
  const originalStr =
    typeof originalPayHook === 'string'
      ? originalPayHook
      : (originalPayHook as any)?.toString?.() ?? ''
  const useActiveHook =
    !!activeDataHook &&
    !isZeroAddress(activeDataHook) &&
    (isZeroAddress(originalStr) ||
      activeDataHook.toLowerCase() !== originalStr.toLowerCase()) &&
    !!primaryTerminalAddress &&
    projectId != null

  const activePayHookContract = useContract({
    address: useActiveHook ? (activeDataHook as string) : '',
    abi: LaunchPadPayHook.abi,
    chain: selectedChain,
  })

  const { data: activeStage } = useRead({
    contract: activePayHookContract,
    method: 'stage',
    params: [primaryTerminalAddress, projectId],
    deps: [numericMissionId, projectId, activeDataHook],
  })

  // Fallback: MissionCreator.stage() (reads the original PayHook).
  const { data: missionCreatorStage } = useRead({
    contract: missionCreatorContract,
    method: 'stage',
    params: [numericMissionId],
    deps: [numericMissionId],
  })

  // When a re-open is live, only surface the active hook's stage. Falling
  // back to `missionCreatorStage` here would leak the stale original stage
  // (e.g. stage 3 refund) while `activeStage` is still loading or if its
  // read fails, and callers using `currentStage ?? ssrStage` would never
  // fall back to the re-open-aware SSR value. Returning `undefined` in that
  // window preserves the fallback path.
  const stage = useActiveHook ? activeStage : missionCreatorStage

  if (numericMissionId === undefined) return undefined
  return stage ? +stage.toString() : undefined
}
