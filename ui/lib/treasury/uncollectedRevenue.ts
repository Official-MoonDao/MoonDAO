/**
 * Revenue MoonDAO has a claim on but has not received.
 *
 * The Launchpad fee is the motivating case. MoonDAO's 2.5% is only transferred
 * when a mission owner calls `sendPayoutsOf`, so ETH sitting in a Juicebox
 * terminal represents a fee we will collect later — or never, if the mission
 * refunds. None of it appears in trailing-year revenue, because on-chain nothing
 * has moved yet.
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
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import {
  DEFAULT_CHAIN_V5,
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
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
  summariseLaunchpadUncollected,
} from './launchpadPipeline'
import { LAUNCHPAD_TREASURY_FEE_RATE } from './programRevenue'

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
  detail: string
  available: boolean
}

export interface UncollectedRevenueResult {
  receivableUSD: number
  contingentUSD: number
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

async function readMissionUncollected(): Promise<{
  missions: MissionUncollected[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const tableName = MISSION_TABLE_NAMES[chainSlug]
  const missionCreatorAddress = MISSION_CREATOR_ADDRESSES[chainSlug]

  if (!tableName || !missionCreatorAddress) {
    warnings.push(`No mission registry configured for ${chainSlug} — Launchpad pipeline omitted.`)
    return { missions: [], warnings }
  }
  if (!process.env.TABLELAND_PRIVATE_KEY) {
    warnings.push('TABLELAND_PRIVATE_KEY missing — Launchpad pipeline omitted.')
    return { missions: [], warnings }
  }

  const rows: any[] = (await queryTable(chain, `SELECT id, projectId FROM ${tableName}`)) || []
  const allCandidates = rows
    .map((r) => ({ missionId: Number(r.id), projectId: Number(r.projectId) }))
    .filter(
      (r) =>
        Number.isFinite(r.projectId) &&
        r.projectId > 0 &&
        !BLOCKED_MISSIONS.has(r.missionId) &&
        !BLOCKED_MISSIONS.has(String(r.missionId))
    )

  // Always price Frank's flight first so a long registry cannot drop it.
  const pinned = allCandidates.filter((r) => r.missionId === FRANK_MISSION_ID)
  const rest = allCandidates.filter((r) => r.missionId !== FRANK_MISSION_ID)
  const candidates = [...pinned, ...rest]

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
  const missionCreator = getContract({
    client: serverClient,
    address: missionCreatorAddress,
    chain,
    abi: MissionCreatorABI.abi as any,
  })
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
        const [balance, creatorStage] = await Promise.all([
          readContract({
            contract: terminalStore,
            method: 'balanceOf' as string,
            params: [JBV5_TERMINAL_ADDRESS, projectId, JB_NATIVE_TOKEN_ADDRESS],
          }),
          readContract({
            contract: missionCreator,
            method: 'stage' as string,
            params: [missionId],
          }),
        ])
        const undistributedETH = Number(balance?.toString() ?? 0) / 1e18
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

  const feePct = (LAUNCHPAD_TREASURY_FEE_RATE * 100).toFixed(1)

  for (const mission of summary.missions) {
    if (mission.kind === 'forfeited') continue
    const pledgedUSD = getMissionOffChainCommittedUsd(mission.missionId)
    const raisedUSD = mission.raisedETH * ethPriceUSD
    const raisedBits = [
      `${mission.raisedETH.toFixed(2)} ETH raised on-chain (${usdPlain(raisedUSD)})`,
      pledgedUSD > 0 ? `${usdPlain(pledgedUSD)} pledged off-chain` : null,
    ].filter(Boolean)
    lines.push({
      label: mission.name,
      kind: mission.kind,
      eth: mission.feeETH,
      usd: mission.feeETH * ethPriceUSD,
      raisedETH: mission.raisedETH,
      raisedUSD,
      pledgedUSD: pledgedUSD > 0 ? pledgedUSD : undefined,
      detail:
        mission.kind === 'receivable'
          ? `${raisedBits.join(' + ')}. ${feePct}% treasury fee is earned — collected when payouts are sent.`
          : `${raisedBits.join(' + ')}. ${feePct}% treasury fee is collected only if the mission closes; refunded otherwise.`,
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
      `${(summary.forfeitedETH * ethPriceUSD).toFixed(0)} USD of fees sit with ${
        summary.refundingMissions
      } refunding mission(s) and will not be collected.`
    )
  }

  const receivableUSD = lines.filter((l) => l.kind === 'receivable').reduce((s, l) => s + l.usd, 0)
  const contingentUSD = lines.filter((l) => l.kind === 'contingent').reduce((s, l) => s + l.usd, 0)

  return {
    receivableUSD,
    contingentUSD,
    lines,
    missionsConsidered,
    note: 'Not in revenue or runway. Receivable is earned and waiting on a payout; contingent depends on the mission closing.',
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
