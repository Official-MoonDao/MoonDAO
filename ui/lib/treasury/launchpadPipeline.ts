/**
 * Launchpad fee pipeline arithmetic.
 *
 * Split from `uncollectedRevenue.ts` so the stage-to-category rules can be
 * imported and tested without pulling in the thirdweb server client, which
 * builds an RPC client at module load and needs credentials to exist.
 */
import {
  LAUNCHPAD_LIQUIDITY_RATE,
  LAUNCHPAD_TREASURY_FEE_RATE,
} from './programRevenue'

export interface LaunchpadRates {
  /** Cash split straight to the treasury on payout. */
  treasury: number
  /** Seeds MoonDAO-owned Uniswap liquidity via the mission's PoolDeployer. */
  liquidity: number
}

export const LAUNCHPAD_RATES: LaunchpadRates = {
  treasury: LAUNCHPAD_TREASURY_FEE_RATE,
  liquidity: LAUNCHPAD_LIQUIDITY_RATE,
}

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
  /** 2.5% cash split to the treasury. */
  treasuryETH: number
  /** 5% seeding MoonDAO-owned Uniswap liquidity. */
  liquidityETH: number
  /** Both together — everything the raise routes to MoonDAO. */
  totalETH: number
}

export interface LaunchpadUncollectedSummary {
  receivableETH: number
  receivableTreasuryETH: number
  receivableLiquidityETH: number
  contingentETH: number
  contingentTreasuryETH: number
  contingentLiquidityETH: number
  /** Value we will never see because the mission is refunding. */
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
 * Value each mission's undistributed balance routes to MoonDAO — the 2.5% cash
 * split plus the 5% liquidity slice — and bucket it by whether it is earned:
 *   - goal met  → earned, only the payout call is outstanding (receivable)
 *   - raising   → depends on the mission closing successfully (contingent)
 *   - refunding → the money goes back to contributors, so we collect nothing
 *
 * The liquidity slice is not cash: it mints a Uniswap position MoonDAO controls,
 * which has to be withdrawn before it can pay for anything. It is counted here
 * because it is MoonDAO value the raise creates, and tracked apart from the cash
 * so nobody mistakes the two.
 */
export function summariseLaunchpadUncollected(
  missions: MissionUncollected[],
  rates: LaunchpadRates = LAUNCHPAD_RATES
): LaunchpadUncollectedSummary {
  const summary: LaunchpadUncollectedSummary = {
    receivableETH: 0,
    receivableTreasuryETH: 0,
    receivableLiquidityETH: 0,
    contingentETH: 0,
    contingentTreasuryETH: 0,
    contingentLiquidityETH: 0,
    forfeitedETH: 0,
    receivableMissions: 0,
    contingentMissions: 0,
    refundingMissions: 0,
    missions: [],
  }

  for (const mission of missions) {
    const raisedETH = Math.max(0, mission.undistributedETH)
    const treasuryETH = raisedETH * rates.treasury
    const liquidityETH = raisedETH * rates.liquidity
    const totalETH = treasuryETH + liquidityETH
    if (!(totalETH > 0)) continue

    const stage = effectiveMissionStage(mission)
    let kind: LaunchpadLineKind = 'contingent'
    switch (stage) {
      case MISSION_STAGE.GOAL_MET:
        kind = 'receivable'
        summary.receivableETH += totalETH
        summary.receivableTreasuryETH += treasuryETH
        summary.receivableLiquidityETH += liquidityETH
        summary.receivableMissions += 1
        break
      case MISSION_STAGE.REFUNDING:
      case MISSION_STAGE.REFUND_WINDOW_PASSED:
        kind = 'forfeited'
        summary.forfeitedETH += totalETH
        summary.refundingMissions += 1
        break
      // Anything else, including an unrecognised stage, is treated as unearned
      // rather than assumed good.
      default:
        kind = 'contingent'
        summary.contingentETH += totalETH
        summary.contingentTreasuryETH += treasuryETH
        summary.contingentLiquidityETH += liquidityETH
        summary.contingentMissions += 1
    }

    summary.missions.push({
      missionId: mission.missionId,
      projectId: mission.projectId,
      name: missionName(mission),
      stage,
      kind,
      raisedETH,
      treasuryETH,
      liquidityETH,
      totalETH,
    })
  }

  summary.missions.sort((a, b) => b.raisedETH - a.raisedETH)
  return summary
}
