/**
 * Launchpad fee pipeline arithmetic.
 *
 * Split from `uncollectedRevenue.ts` so the stage-to-category rules can be
 * imported and tested without pulling in the thirdweb server client, which
 * builds an RPC client at module load and needs credentials to exist.
 */
import { LAUNCHPAD_TREASURY_FEE_RATE } from './programRevenue'

/** Mission funding stages, per `LaunchPadPayHook.stage`. */
export const MISSION_STAGE = {
  RAISING: 1,
  GOAL_MET: 2,
  REFUNDING: 3,
  REFUND_WINDOW_PASSED: 4,
} as const

/** Mission 4 — Go to Space with Frank White. */
export const FRANK_MISSION_ID = 4

export const KNOWN_MISSION_NAMES: Record<number, string> = {
  [FRANK_MISSION_ID]: 'Go to Space with Frank White',
}

export interface MissionUncollected {
  missionId: number
  projectId: number
  stage: number
  /** ETH sitting in the Juicebox terminal, not yet paid out. */
  undistributedETH: number
  name?: string
}

export type LaunchpadLineKind = 'receivable' | 'contingent' | 'forfeited'

export interface LaunchpadMissionLine {
  missionId: number
  projectId: number
  name: string
  stage: number
  kind: LaunchpadLineKind
  raisedETH: number
  feeETH: number
}

export interface LaunchpadUncollectedSummary {
  receivableETH: number
  contingentETH: number
  /** Fees we will never see because the mission is refunding. */
  forfeitedETH: number
  receivableMissions: number
  contingentMissions: number
  refundingMissions: number
  missions: LaunchpadMissionLine[]
}

/**
 * MissionCreator.stage can be stale after a re-open. Frank's first raise
 * ended in refund-window-passed, then the campaign reopened with a new
 * PayHook while the ETH stayed in the terminal. A leftover refund stage
 * plus a live balance means the money is still in play, not forfeited.
 */
export function effectiveMissionStage(mission: MissionUncollected): number {
  if (
    mission.missionId === FRANK_MISSION_ID &&
    mission.undistributedETH > 0 &&
    (mission.stage === MISSION_STAGE.REFUNDING ||
      mission.stage === MISSION_STAGE.REFUND_WINDOW_PASSED)
  ) {
    return MISSION_STAGE.RAISING
  }
  return mission.stage
}

function missionName(mission: MissionUncollected): string {
  return (
    mission.name?.trim() ||
    KNOWN_MISSION_NAMES[mission.missionId] ||
    `Mission #${mission.missionId}`
  )
}

/**
 * Apply the treasury fee rate to each mission's undistributed balance and split
 * by whether the fee is earned yet:
 *   - goal met  → earned, only the payout call is outstanding (receivable)
 *   - raising   → depends on the mission closing successfully (contingent)
 *   - refunding → the money goes back to contributors, so we collect nothing
 */
export function summariseLaunchpadUncollected(
  missions: MissionUncollected[],
  feeRate: number = LAUNCHPAD_TREASURY_FEE_RATE
): LaunchpadUncollectedSummary {
  const summary: LaunchpadUncollectedSummary = {
    receivableETH: 0,
    contingentETH: 0,
    forfeitedETH: 0,
    receivableMissions: 0,
    contingentMissions: 0,
    refundingMissions: 0,
    missions: [],
  }

  for (const mission of missions) {
    const raisedETH = Math.max(0, mission.undistributedETH)
    const fee = raisedETH * feeRate
    if (!(fee > 0)) continue

    const stage = effectiveMissionStage(mission)
    let kind: LaunchpadLineKind = 'contingent'
    switch (stage) {
      case MISSION_STAGE.GOAL_MET:
        kind = 'receivable'
        summary.receivableETH += fee
        summary.receivableMissions += 1
        break
      case MISSION_STAGE.RAISING:
        kind = 'contingent'
        summary.contingentETH += fee
        summary.contingentMissions += 1
        break
      case MISSION_STAGE.REFUNDING:
      case MISSION_STAGE.REFUND_WINDOW_PASSED:
        kind = 'forfeited'
        summary.forfeitedETH += fee
        summary.refundingMissions += 1
        break
      default:
        kind = 'contingent'
        summary.contingentETH += fee
        summary.contingentMissions += 1
    }

    summary.missions.push({
      missionId: mission.missionId,
      projectId: mission.projectId,
      name: missionName(mission),
      stage,
      kind,
      raisedETH,
      feeETH: fee,
    })
  }

  summary.missions.sort((a, b) => b.raisedETH - a.raisedETH)
  return summary
}
