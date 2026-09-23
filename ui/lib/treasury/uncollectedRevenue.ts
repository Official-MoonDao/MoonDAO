/**
 * Revenue MoonDAO has a claim on but has not received.
 *
 * The Launchpad splits are the motivating case. A funded mission routes 7.5% to
 * MoonDAO — 2.5% cash to the treasury and 5% into a MoonDAO-owned Uniswap
 * position — but neither moves until the mission owner calls `sendPayoutsOf`. So
 * ETH sitting in a Juicebox terminal is value we collect later, or never if the
 * mission refunds. None of it appears in trailing-year revenue, because on-chain
 * nothing has moved yet. DePrize prize pools pay into launchpad projects too, so
 * the same 7.5% applies to them.
 *
 * Split the way a financial statement would:
 *   - `receivable` — earned. The mission has met its goal, so the split is
 *     determined and only the payout call is outstanding. Accrued revenue.
 *   - `contingent` — not earned. The mission is still raising and refunds if it
 *     misses its goal, so the claim depends on a future outcome. A contingent
 *     asset, which accounting does not let you book.
 *
 * Neither is added to revenue or to runway. Booking money you have not collected
 * is how a treasury talks itself into a longer runway than it has.
 */
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import {
  DEFAULT_CHAIN_V5,
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { getMissionOffChainCommittedUsd } from 'const/missionMilestones'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { getContract, readContract } from 'thirdweb'
import {
  extractActiveDataHook,
  ZERO_ADDRESS,
} from '@/lib/mission/extractActiveDataHook'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import {
  FRANK_MISSION_ID,
  KNOWN_MISSION_NAMES,
  LaunchpadUncollectedSummary,
  MissionUncollected,
  TRACKED_LAUNCHPAD_RAISES,
  summariseLaunchpadUncollected,
} from './launchpadPipeline'
import {
  LAUNCHPAD_LIQUIDITY_RATE,
  LAUNCHPAD_MOONDAO_RATE,
  LAUNCHPAD_TREASURY_FEE_RATE,
} from './programRevenue'

/** Cap the fan-out so one endpoint can't spray hundreds of RPC reads. */
const MAX_MISSIONS = 60
const READ_BATCH = 6

export type UncollectedKind = 'receivable' | 'contingent'

export interface UncollectedLine {
  label: string
  kind: UncollectedKind
  eth: number
  usd: number
  raisedETH?: number
  raisedUSD?: number
  pledgedUSD?: number
  /** 2.5% cash split to the treasury. */
  treasuryUSD?: number
  /** 5% seeding MoonDAO-owned Uniswap liquidity. */
  liquidityUSD?: number
  /** True when the raise figure is a configured estimate, not a live read. */
  estimated?: boolean
  detail: string
  available: boolean
}

export interface UncollectedRevenueResult {
  /** 7.5% of every tracked raise. The headline projected figure. */
  projectedUSD: number
  projectedTreasuryUSD: number
  projectedLiquidityUSD: number
  /** Total campaign dollars the projection is applied to. */
  raisedBaseUSD: number
  receivableUSD: number
  contingentUSD: number
  /** Cash share (2.5%) of receivable + contingent. */
  treasuryUSD: number
  /** Liquidity share (5%) of receivable + contingent. */
  liquidityUSD: number
  lines: UncollectedLine[]
  missionsConsidered: number
  note: string
  warnings: string[]
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))))
  }
  return out
}

async function readLivePayHookStage(
  jbController: any,
  jbDirectory: any,
  projectId: number
): Promise<number | null> {
  try {
    const [ruleset, primaryTerminal] = await Promise.all([
      readContract({
        contract: jbController,
        method: 'currentRulesetOf' as string,
        params: [projectId],
      }),
      readContract({
        contract: jbDirectory,
        method: 'primaryTerminalOf' as string,
        params: [projectId, JB_NATIVE_TOKEN_ADDRESS],
      }),
    ])
    const hook = extractActiveDataHook(ruleset)
    const terminal = (primaryTerminal as any)?.toString?.() ?? String(primaryTerminal || '')
    if (!hook || hook === ZERO_ADDRESS || !terminal || terminal === ZERO_ADDRESS) {
      return null
    }
    const payHook = getContract({
      client: serverClient,
      address: hook,
      chain: DEFAULT_CHAIN_V5,
      abi: LaunchPadPayHookABI.abi as any,
    })
    const stage = await readContract({
      contract: payHook,
      method: 'stage' as string,
      params: [terminal, projectId],
    })
    const n = Number(stage?.toString() ?? NaN)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** Recover a tracked raise's Juicebox project id without the registry. */
async function resolveProjectIdFromToken(tokenAddress: string): Promise<number | null> {
  try {
    const jbTokens = getContract({
      client: serverClient,
      address: JBV5_TOKENS_ADDRESS,
      chain: DEFAULT_CHAIN_V5,
      abi: JBV5Tokens.abi as any,
    })
    const projectId = await readContract({
      contract: jbTokens,
      method: 'projectIdOf' as string,
      params: [tokenAddress],
    })
    const n = Number(projectId?.toString() ?? NaN)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

async function readMissionUncollected(): Promise<{
  missions: MissionUncollected[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const tableName = MISSION_TABLE_NAMES[chainSlug]
  const missionCreatorAddress = MISSION_CREATOR_ADDRESSES[chainSlug]

  let rows: any[] = []
  if (!tableName) {
    warnings.push(`No mission registry configured for ${chainSlug}.`)
  } else if (!process.env.TABLELAND_PRIVATE_KEY) {
    warnings.push('TABLELAND_PRIVATE_KEY missing — only tracked raises are priced.')
  } else {
    try {
      rows = (await queryTable(chain, `SELECT id, projectId FROM ${tableName}`)) || []
    } catch (err: any) {
      warnings.push(
        `Mission registry read failed (${err?.message || 'unknown'}) — only tracked raises are priced.`
      )
    }
  }

  const allCandidates = rows
    .map((r) => ({ missionId: Number(r.id), projectId: Number(r.projectId) }))
    .filter(
      (r) =>
        Number.isFinite(r.projectId) &&
        r.projectId > 0 &&
        !BLOCKED_MISSIONS.has(r.missionId) &&
        !BLOCKED_MISSIONS.has(String(r.missionId))
    )

  // Tracked raises come first and are added even when the registry gave us
  // nothing, resolving their project id from the mission token if needed.
  const byMission = new Map(allCandidates.map((c) => [c.missionId, c]))
  const pinned: { missionId: number; projectId: number }[] = []
  for (const tracked of TRACKED_LAUNCHPAD_RAISES) {
    const known = byMission.get(tracked.missionId)
    if (known) {
      pinned.push(known)
      byMission.delete(tracked.missionId)
      continue
    }
    const projectId = tracked.tokenAddress
      ? await resolveProjectIdFromToken(tracked.tokenAddress)
      : null
    if (projectId) {
      pinned.push({ missionId: tracked.missionId, projectId })
    } else {
      warnings.push(
        `Could not resolve a project id for ${tracked.name} — using the configured estimate.`
      )
    }
  }
  const candidates = [...pinned, ...byMission.values()]

  if (candidates.length > MAX_MISSIONS) {
    warnings.push(
      `${candidates.length} missions found; only the first ${MAX_MISSIONS} were priced.`
    )
  }

  const terminalStore = getContract({
    client: serverClient,
    address: JBV5_TERMINAL_STORE_ADDRESS,
    chain,
    abi: JBV5TerminalStore.abi as any,
  })
  const missionCreator = missionCreatorAddress
    ? getContract({
        client: serverClient,
        address: missionCreatorAddress,
        chain,
        abi: MissionCreatorABI.abi as any,
      })
    : null
  const jbController = getContract({
    client: serverClient,
    address: JBV5_CONTROLLER_ADDRESS,
    chain,
    abi: JBV5Controller.abi as any,
  })
  const jbDirectory = getContract({
    client: serverClient,
    address: JBV5_DIRECTORY_ADDRESS,
    chain,
    abi: JBV5Directory.abi as any,
  })

  const results = await mapWithConcurrency(
    candidates.slice(0, MAX_MISSIONS),
    READ_BATCH,
    async ({ missionId, projectId }): Promise<MissionUncollected | null> => {
      try {
        const [balance, usedPayoutLimit, creatorStage] = await Promise.all([
          readContract({
            contract: terminalStore,
            method: 'balanceOf' as string,
            params: [JBV5_TERMINAL_ADDRESS, projectId, JB_NATIVE_TOKEN_ADDRESS],
          }),
          // Already-distributed payouts. Total raised is this plus the balance,
          // so a mission that has paid out still shows its full raise.
          readContract({
            contract: terminalStore,
            method: 'usedPayoutLimitOf' as string,
            params: [
              JBV5_TERMINAL_ADDRESS,
              projectId,
              JB_NATIVE_TOKEN_ADDRESS,
              2,
              JB_NATIVE_TOKEN_ID,
            ],
          }).catch(() => BigInt(0)),
          missionCreator
            ? readContract({
                contract: missionCreator,
                method: 'stage' as string,
                params: [missionId],
              }).catch(() => BigInt(0))
            : Promise.resolve(BigInt(0)),
        ])
        const undistributedETH = Number(balance?.toString() ?? 0) / 1e18
        const distributedETH = Number(usedPayoutLimit?.toString() ?? 0) / 1e18
        let stage = Number(creatorStage?.toString() ?? 0)

        // Re-opened missions (Frank) keep ETH in the terminal but the live
        // stage lives on the ruleset dataHook, not MissionCreator.
        if (undistributedETH > 0 || missionId === FRANK_MISSION_ID) {
          const liveStage = await readLivePayHookStage(
            jbController,
            jbDirectory,
            projectId
          )
          if (liveStage != null) stage = liveStage
        }

        return {
          missionId,
          projectId,
          stage,
          undistributedETH,
          distributedETH,
          name: KNOWN_MISSION_NAMES[missionId],
        }
      } catch (err: any) {
        warnings.push(`Mission ${missionId}: ${err?.message || 'read failed'}`)
        return null
      }
    }
  )

  return {
    missions: results.filter((m): m is MissionUncollected => m !== null),
    warnings,
  }
}

// Mission balances move slowly and this walks the whole registry — a Tableland
// query plus two reads per mission. Memoise like the AUM and subscription
// helpers so repeated dashboard loads don't re-run the fan-out. Keyed on nothing
// but time: ETH price only scales the output, so it is applied after the cache.
let memo: { fetchedAt: number; missions: MissionUncollected[]; warnings: string[] } | null = null
const MEMO_TTL_MS = 10 * 60 * 1000

async function getMissionsCached() {
  if (memo && Date.now() - memo.fetchedAt < MEMO_TTL_MS) {
    return { missions: memo.missions, warnings: memo.warnings }
  }
  const result = await readMissionUncollected()
  memo = { fetchedAt: Date.now(), ...result }
  return result
}

/**
 * Uncollected Launchpad fees, plus any DePrize fees accrued but not swept.
 */
export async function getUncollectedRevenue(
  ethPriceUSD: number
): Promise<UncollectedRevenueResult> {
  const warnings: string[] = []
  const lines: UncollectedLine[] = []
  let missionsConsidered = 0
  let summary: LaunchpadUncollectedSummary = summariseLaunchpadUncollected([])

  try {
    const { missions, warnings: readWarnings } = await getMissionsCached()
    warnings.push(...readWarnings)
    missionsConsidered = missions.length
    summary = summariseLaunchpadUncollected(missions)
  } catch (err: any) {
    warnings.push(`Launchpad pipeline unavailable: ${err?.message || 'read failed'}`)
  }

  const treasuryPct = (LAUNCHPAD_TREASURY_FEE_RATE * 100).toFixed(1)
  const liquidityPct = (LAUNCHPAD_LIQUIDITY_RATE * 100).toFixed(0)
  const totalPct = (LAUNCHPAD_MOONDAO_RATE * 100).toFixed(1)

  let projectedUSD = 0
  let projectedTreasuryUSD = 0
  let projectedLiquidityUSD = 0
  let raisedBaseUSD = 0

  const priced = new Set<number>()

  for (const mission of summary.missions) {
    priced.add(mission.missionId)
    if (mission.kind === 'forfeited') continue

    const pledgedUSD = getMissionOffChainCommittedUsd(mission.missionId)
    const onChainRaisedUSD = mission.raisedETH * ethPriceUSD
    // Off-chain pledges land through the same launchpad splits, so project the
    // MoonDAO share on the whole campaign, not just the part already on-chain.
    const raisedUSD = onChainRaisedUSD + pledgedUSD
    const treasuryUSD = raisedUSD * LAUNCHPAD_TREASURY_FEE_RATE
    const liquidityUSD = raisedUSD * LAUNCHPAD_LIQUIDITY_RATE
    const totalUSD = treasuryUSD + liquidityUSD

    projectedUSD += totalUSD
    projectedTreasuryUSD += treasuryUSD
    projectedLiquidityUSD += liquidityUSD
    raisedBaseUSD += raisedUSD

    const raisedBits = [
      `${mission.raisedETH.toFixed(2)} ETH on-chain (${usdPlain(onChainRaisedUSD)})`,
      pledgedUSD > 0 ? `${usdPlain(pledgedUSD)} pledged off-chain` : null,
    ].filter(Boolean)

    lines.push({
      label: mission.name,
      kind: mission.kind,
      eth: mission.totalETH,
      usd: totalUSD,
      raisedETH: mission.raisedETH,
      raisedUSD,
      pledgedUSD: pledgedUSD > 0 ? pledgedUSD : undefined,
      treasuryUSD,
      liquidityUSD,
      detail:
        `${usdPlain(raisedUSD)} raised (${raisedBits.join(' + ')}) · ${totalPct}% to MoonDAO = ` +
        `${treasuryPct}% cash ${usdPlain(treasuryUSD)} + ` +
        `${liquidityPct}% liquidity ${usdPlain(liquidityUSD)}` +
        (mission.kind === 'receivable'
          ? '. Earned — splits on the payout call.'
          : '. Collected if the mission closes; refunded otherwise.'),
      available: true,
    })
  }

  // A tracked raise must never silently vanish because a chain read failed.
  for (const tracked of TRACKED_LAUNCHPAD_RAISES) {
    if (priced.has(tracked.missionId)) continue
    const pledgedUSD = getMissionOffChainCommittedUsd(tracked.missionId)
    const raisedUSD = (tracked.fallbackOnChainRaisedUSD ?? 0) + pledgedUSD
    if (!(raisedUSD > 0)) continue

    const treasuryUSD = raisedUSD * LAUNCHPAD_TREASURY_FEE_RATE
    const liquidityUSD = raisedUSD * LAUNCHPAD_LIQUIDITY_RATE
    const totalUSD = treasuryUSD + liquidityUSD

    projectedUSD += totalUSD
    projectedTreasuryUSD += treasuryUSD
    projectedLiquidityUSD += liquidityUSD
    raisedBaseUSD += raisedUSD

    warnings.push(
      `${tracked.name}: live Juicebox read unavailable — projection uses the configured ${usdPlain(
        raisedUSD
      )} raised.`
    )
    lines.push({
      label: tracked.name,
      kind: 'contingent',
      eth: 0,
      usd: totalUSD,
      raisedUSD,
      pledgedUSD: pledgedUSD > 0 ? pledgedUSD : undefined,
      treasuryUSD,
      liquidityUSD,
      estimated: true,
      detail:
        `${usdPlain(raisedUSD)} raised (configured estimate — live read unavailable) · ` +
        `${totalPct}% to MoonDAO = ${treasuryPct}% cash ${usdPlain(treasuryUSD)} + ` +
        `${liquidityPct}% liquidity ${usdPlain(liquidityUSD)}.`,
      available: true,
    })
  }

  const deprizeConfigured = Boolean(DEPRIZE_FEE_ROUTER_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)])
  if (deprizeConfigured) {
    lines.push({
      label: 'DePrize trade fees not yet swept',
      kind: 'receivable',
      eth: 0,
      usd: 0,
      detail: '1% LMSR fees sitting on the market contract until someone calls sweepFees.',
      available: true,
    })
  }

  if (summary.forfeitedETH > 0) {
    warnings.push(
      `${usdPlain(summary.forfeitedETH * ethPriceUSD)} sits with ${
        summary.refundingMissions
      } refunding mission(s) and will not be collected.`
    )
  }

  const receivableUSD = lines.filter((l) => l.kind === 'receivable').reduce((s, l) => s + l.usd, 0)
  const contingentUSD = lines.filter((l) => l.kind === 'contingent').reduce((s, l) => s + l.usd, 0)

  return {
    projectedUSD,
    projectedTreasuryUSD,
    projectedLiquidityUSD,
    raisedBaseUSD,
    receivableUSD,
    contingentUSD,
    treasuryUSD: projectedTreasuryUSD,
    liquidityUSD: projectedLiquidityUSD,
    lines,
    missionsConsidered,
    note: `${totalPct}% of every launchpad-funded raise goes to MoonDAO: ${treasuryPct}% as cash on the payout call, ${liquidityPct}% as MoonDAO-owned Uniswap liquidity that must be withdrawn before it can be spent. Projected, not booked — it is excluded from revenue and from runway.`,
    warnings,
  }
}

function usdPlain(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}
