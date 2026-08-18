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

export interface MissionUncollected {
  missionId: number
  projectId: number
  stage: number
  /** ETH sitting in the Juicebox terminal, not yet paid out. */
  undistributedETH: number
}

export interface LaunchpadUncollectedSummary {
  receivableETH: number
  contingentETH: number
  /** Fees we will never see because the mission is refunding. */
  forfeitedETH: number
  receivableMissions: number
  contingentMissions: number
  refundingMissions: number
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
  }

  for (const mission of missions) {
    const fee = Math.max(0, mission.undistributedETH) * feeRate
    if (!(fee > 0)) continue

    switch (mission.stage) {
      case MISSION_STAGE.GOAL_MET:
        summary.receivableETH += fee
        summary.receivableMissions += 1
        break
      case MISSION_STAGE.RAISING:
        summary.contingentETH += fee
        summary.contingentMissions += 1
        break
      case MISSION_STAGE.REFUNDING:
      case MISSION_STAGE.REFUND_WINDOW_PASSED:
        summary.forfeitedETH += fee
        summary.refundingMissions += 1
        break
      default:
        // An unrecognised stage is treated as unearned rather than assumed good.
        summary.contingentETH += fee
        summary.contingentMissions += 1
    }
  }

  return summary
}
