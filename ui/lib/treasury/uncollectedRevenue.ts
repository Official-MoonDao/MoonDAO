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
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import {
  DEFAULT_CHAIN_V5,
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import {
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
  const candidates = rows
    .map((r) => ({ missionId: Number(r.id), projectId: Number(r.projectId) }))
    .filter((r) => Number.isFinite(r.projectId) && r.projectId > 0)

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

  const results = await mapWithConcurrency(
    candidates.slice(0, MAX_MISSIONS),
    READ_BATCH,
    async ({ missionId, projectId }): Promise<MissionUncollected | null> => {
      try {
        const [balance, stage] = await Promise.all([
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
        return {
          missionId,
          projectId,
          stage: Number(stage?.toString() ?? 0),
          undistributedETH: Number(balance?.toString() ?? 0) / 1e18,
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
    const { missions, warnings: readWarnings } = await readMissionUncollected()
    warnings.push(...readWarnings)
    missionsConsidered = missions.length
    summary = summariseLaunchpadUncollected(missions)
  } catch (err: any) {
    warnings.push(`Launchpad pipeline unavailable: ${err?.message || 'read failed'}`)
  }

  const feePct = (LAUNCHPAD_TREASURY_FEE_RATE * 100).toFixed(1)

  lines.push({
    label: 'Launchpad fees on funded missions',
    kind: 'receivable',
    eth: summary.receivableETH,
    usd: summary.receivableETH * ethPriceUSD,
    detail: `${feePct}% of ETH held by ${summary.receivableMissions} mission(s) that have met their goal. Earned — collected when the mission owner sends payouts.`,
    available: true,
  })

  lines.push({
    label: 'Launchpad fees on missions still raising',
    kind: 'contingent',
    eth: summary.contingentETH,
    usd: summary.contingentETH * ethPriceUSD,
    detail: `${feePct}% of ETH held by ${summary.contingentMissions} mission(s) below their goal. Collected only if they close successfully; refunded otherwise.`,
    available: true,
  })

  const deprizeConfigured = Boolean(DEPRIZE_FEE_ROUTER_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)])
  lines.push({
    label: 'DePrize trade fees not yet swept',
    kind: 'receivable',
    eth: 0,
    usd: 0,
    detail: deprizeConfigured
      ? '1% LMSR fees sitting on the market contract until someone calls sweepFees.'
      : 'DePrize has no mainnet deployment, so no fees are accruing yet.',
    available: deprizeConfigured,
  })

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
    note: 'Excluded from revenue and from runway. Receivable is earned and awaiting a payout call; contingent depends on a mission closing successfully and is not bookable.',
    warnings,
  }
}
