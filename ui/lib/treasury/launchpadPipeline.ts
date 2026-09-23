/**
 * Launchpad fee pipeline arithmetic.
 *
 * Split from `uncollectedRevenue.ts` so the stage-to-category rules can be
 * imported and tested without pulling in the thirdweb server client, which
 * builds an RPC client at module load and needs credentials to exist.
 */
import { OVERVIEW_TOKEN_ADDRESS } from 'const/config'
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

/**
 * Campaigns whose projected MoonDAO share we always report, even if the
 * Tableland mission registry is unavailable. Without this the entire Launchpad
 * projection silently disappeared whenever the registry read failed, which is
 * how Frank's raise went missing from the dashboard.
 *
 * `tokenAddress` lets us recover the Juicebox project id straight from
 * `JBTokens.projectIdOf`, so a tracked raise needs no registry at all.
 * `fallbackOnChainRaisedUSD` is a documented floor used only when the chain
 * reads also fail, so the line degrades to a marked estimate instead of zero.
 */
export interface TrackedRaise {
  missionId: number
  name: string
  tokenAddress?: string
  fallbackOnChainRaisedUSD?: number
}

export const TRACKED_LAUNCHPAD_RAISES: TrackedRaise[] = [
  {
    missionId: FRANK_MISSION_ID,
    name: KNOWN_MISSION_NAMES[FRANK_MISSION_ID],
    tokenAddress: OVERVIEW_TOKEN_ADDRESS,
    // Round one took in over $172k raised-or-pledged, of which
    // MISSION_OFF_CHAIN_COMMITTED_USD holds $116.5k off-chain, leaving ~$55.5k
    // on-chain. Used only if the Juicebox reads fail; the line is then marked
    // as an estimate.
    fallbackOnChainRaisedUSD: 55_500,
  },
]

export interface MissionUncollected {
  missionId: number
  projectId: number
  stage: number
  /** ETH sitting in the Juicebox terminal, not yet paid out. */
  undistributedETH: number
  /** ETH already sent out via payouts. Counts toward total raised. */
  distributedETH?: number
  name?: string
  /** True when the figures come from config because live reads failed. */
  estimated?: boolean
}

export type LaunchpadLineKind = 'receivable' | 'contingent' | 'forfeited'

export interface LaunchpadMissionLine {
  missionId: number
  projectId: number
  name: string
  stage: number
  kind: LaunchpadLineKind
  /** Everything the mission has taken in: still held plus already paid out. */
  raisedETH: number
  /** The part still sitting in the terminal. */
  undistributedETH: number
  /** 2.5% cash split to the treasury, over total raised. */
  treasuryETH: number
  /** 5% seeding MoonDAO-owned Uniswap liquidity, over total raised. */
  liquidityETH: number
  /** Both together — the full 7.5% the raise routes to MoonDAO. */
  totalETH: number
  /** The 7.5% on ETH already paid out, so already in actual revenue. */
  collectedETH: number
  estimated: boolean
}

export interface LaunchpadUncollectedSummary {
  /** 7.5% of everything every live mission has raised. The headline figure. */
  projectedETH: number
  projectedTreasuryETH: number
  projectedLiquidityETH: number
  /** Total ETH raised across live missions. */
  raisedETH: number
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
    projectedETH: 0,
    projectedTreasuryETH: 0,
    projectedLiquidityETH: 0,
    raisedETH: 0,
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
  const moonDaoRate = rates.treasury + rates.liquidity

  for (const mission of missions) {
    const undistributedETH = Math.max(0, mission.undistributedETH)
    const distributedETH = Math.max(0, mission.distributedETH ?? 0)
    const raisedETH = undistributedETH + distributedETH
    const treasuryETH = raisedETH * rates.treasury
    const liquidityETH = raisedETH * rates.liquidity
    const totalETH = treasuryETH + liquidityETH
    if (!(totalETH > 0)) continue

    const stage = effectiveMissionStage(mission)
    // Only the undistributed part is still outstanding; anything already paid
    // out has flowed through the splits and is in actual revenue.
    const openTreasuryETH = undistributedETH * rates.treasury
    const openLiquidityETH = undistributedETH * rates.liquidity
    const openTotalETH = openTreasuryETH + openLiquidityETH

    let kind: LaunchpadLineKind = 'contingent'
    switch (stage) {
      case MISSION_STAGE.GOAL_MET:
        kind = 'receivable'
        summary.receivableETH += openTotalETH
        summary.receivableTreasuryETH += openTreasuryETH
        summary.receivableLiquidityETH += openLiquidityETH
        summary.receivableMissions += 1
        break
      case MISSION_STAGE.REFUNDING:
      case MISSION_STAGE.REFUND_WINDOW_PASSED:
        kind = 'forfeited'
        summary.forfeitedETH += openTotalETH
        summary.refundingMissions += 1
        break
      // Anything else, including an unrecognised stage, is treated as unearned
      // rather than assumed good.
      default:
        kind = 'contingent'
        summary.contingentETH += openTotalETH
        summary.contingentTreasuryETH += openTreasuryETH
        summary.contingentLiquidityETH += openLiquidityETH
        summary.contingentMissions += 1
    }

    // A refunding mission's raise is not projected revenue.
    if (kind !== 'forfeited') {
      summary.projectedETH += totalETH
      summary.projectedTreasuryETH += treasuryETH
      summary.projectedLiquidityETH += liquidityETH
      summary.raisedETH += raisedETH
    }

    summary.missions.push({
      missionId: mission.missionId,
      projectId: mission.projectId,
      name: missionName(mission),
      stage,
      kind,
      raisedETH,
      undistributedETH,
      treasuryETH,
      liquidityETH,
      totalETH,
      collectedETH: distributedETH * moonDaoRate,
      estimated: Boolean(mission.estimated),
    })
  }

  summary.missions.sort((a, b) => b.raisedETH - a.raisedETH)
  return summary
}
