// Server-side only: gathers the past week of MoonDAO activity into a compact
// snapshot that the activity summary prompt is built from.
import ProposalsABI from 'const/abis/Proposals.json'
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_NAMES,
  MARKETPLACE_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_CITIZENS, BLOCKED_MDPS, BLOCKED_PROJECTS, BLOCKED_TEAMS } from 'const/whitelist'
import { getContract, readContract } from 'thirdweb'
import { parseLocationData } from '@/lib/citizen/citizenDataService'
import { getMooneyPrice } from '@/lib/coinstats'
import { PROJECT_PENDING } from '@/lib/nance/types'
import { getProposalStatus } from '@/lib/nance/useProposalStatus'
import { getRecentCitizenTransfers, getRecentTeamTransfers } from '@/lib/network/networkSubgraph'
import { isUntitledLike } from '@/lib/project/getProjectDisplayName'
import { enrichProjectNames } from '@/lib/project/enrichProjectNames'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { getNextTownHallEvent } from '@/lib/townhall/luma'
import { getSummaries } from '@/lib/townhall/summaries'

export const LOOKBACK_DAYS = 7

// User-submitted text (bios, descriptions) is clipped before it reaches the
// model to keep the prompt small and limit what any one row can inject.
const TEXT_LIMIT = 280
const SOURCE_TIMEOUT_MS = 8000

export type ProposalStage = 'member-vote' | 'senate-review'

export type ActivitySnapshot = {
  periodStart: string
  periodEnd: string
  citizens: { id: number; name: string; location?: string; bio?: string }[]
  totalCitizens: number | null
  teams: { id: number; name: string; bio?: string }[]
  jobs: { id: number; title: string; teamId?: number; description?: string }[]
  listings: {
    id: number
    title: string
    price?: string
    currency?: string
    teamId?: number
    description?: string
  }[]
  // 'member-vote': passed the Senate, citizens can vote now.
  // 'senate-review': waiting on the Senate's temperature check.
  proposals: { mdp: number; name: string; status: ProposalStage }[]
  nextTownHall: { name: string; startAt: string; url: string } | null
  latestTownHall: { title: string; publishedAt: string; excerpt: string } | null
  mooney: { price: number; priceChange24h: number } | null
}

export function clip(text: unknown, limit = TEXT_LIMIT): string | undefined {
  if (typeof text !== 'string') return undefined
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return undefined
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean
}

export function stripHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
}

// Resolves to `fallback` when a source is slow or throws, so one bad source
// drops out of the snapshot instead of failing the whole summary.
async function settle<T>(label: string, work: () => Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[activity-summary] ${label} timed out`)
      resolve(fallback)
    }, SOURCE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([
      work().catch((error) => {
        console.error(`[activity-summary] ${label} failed:`, error)
        return fallback
      }),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

// The location column is usually a string (JSON or plain text), but some rows
// come back from the gateway already parsed into an object.
function placeName(location: unknown): string | undefined {
  if (typeof location === 'string') return clip(parseLocationData(location).name, 80)
  if (location && typeof location === 'object') return clip((location as any).name, 80)
  return undefined
}

// A pending project row (`active = PROJECT_PENDING`) may still be in Senate
// review, in the Member Vote, or already rejected by the Senate. The project
// page tells them apart with the Proposals contract's temp-check flags, so
// the same read is done here. Rejected proposals and ones whose flags can't
// be read get no stage and are left out.
async function withProposalStages(rows: any[]): Promise<any[]> {
  const contract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)],
    abi: ProposalsABI.abi as any,
    chain: DEFAULT_CHAIN_V5,
  })
  return Promise.all(
    rows.map(async (row) => {
      try {
        const [approved, failed] = await Promise.all([
          readContract({ contract, method: 'tempCheckApproved' as string, params: [row.MDP] }),
          readContract({ contract, method: 'tempCheckFailed' as string, params: [row.MDP] }),
        ])
        const status = getProposalStatus(row.active, approved as any, failed as any)
        const stage: ProposalStage | null =
          status === 'Voting' ? 'member-vote' : status === 'Temperature Check' ? 'senate-review' : null
        return { ...row, stage }
      } catch (error) {
        console.error(`[activity-summary] proposal flags for MDP ${row.MDP} failed:`, error)
        return { ...row, stage: null }
      }
    })
  )
}

function mintTimestamps(transfers: { tokenId: string; blockTimestamp: string }[]) {
  const map: Record<string, number> = {}
  for (const t of transfers) {
    if (t.tokenId && t.blockTimestamp && !(t.tokenId in map)) {
      map[t.tokenId] = Number(t.blockTimestamp)
    }
  }
  return map
}

export async function collectActivity(now: Date = new Date()): Promise<ActivitySnapshot> {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const nowTs = Math.floor(now.getTime() / 1000)
  const sinceTs = nowTs - LOOKBACK_DAYS * 24 * 60 * 60

  const citizenTable = CITIZEN_TABLE_NAMES[chainSlug]
  const teamTable = TEAM_TABLE_NAMES[chainSlug]
  const jobTable = JOBS_TABLE_NAMES[chainSlug]
  const marketplaceTable = MARKETPLACE_TABLE_NAMES[chainSlug]
  const projectTable = PROJECT_TABLE_NAMES[chainSlug]
  const citizenWhere = "WHERE view != ''"

  const [
    citizenRows,
    citizenCount,
    citizenTransfers,
    teamRows,
    teamTransfers,
    jobRows,
    listingRows,
    proposalRows,
    nextTownHall,
    townHalls,
    mooney,
  ] = await Promise.all([
    settle(
      'citizens',
      () =>
        queryTable(
          chain,
          `SELECT id, name, description, location FROM ${citizenTable} ${citizenWhere} ORDER BY id DESC LIMIT 25`
        ),
      [] as any[]
    ),
    settle(
      'citizen count',
      () => queryTable(chain, `SELECT COUNT(*) as count FROM ${citizenTable} ${citizenWhere}`),
      [] as any[]
    ),
    settle('citizen mints', () => getRecentCitizenTransfers(50), []),
    settle(
      'teams',
      () =>
        queryTable(chain, `SELECT id, name, description FROM ${teamTable} ORDER BY id DESC LIMIT 15`),
      [] as any[]
    ),
    settle('team mints', () => getRecentTeamTransfers(20), []),
    settle(
      'jobs',
      () =>
        queryTable(
          chain,
          `SELECT id, title, description, teamId FROM ${jobTable} WHERE timestamp >= ${sinceTs} AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 20`
        ),
      [] as any[]
    ),
    settle(
      'marketplace',
      () =>
        queryTable(
          chain,
          `SELECT id, title, description, price, currency, teamId FROM ${marketplaceTable} WHERE timestamp >= ${sinceTs} AND (startTime = 0 OR startTime <= ${nowTs}) AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 20`
        ),
      [] as any[]
    ),
    settle(
      'proposals',
      async () => {
        const rows = await queryTable(
          chain,
          `SELECT id, MDP, name, active, proposalIPFS FROM ${projectTable} WHERE active = ${PROJECT_PENDING} ORDER BY id DESC LIMIT 10`
        )
        await enrichProjectNames(rows)
        return withProposalStages(rows)
      },
      [] as any[]
    ),
    settle('next town hall', () => getNextTownHallEvent(), null),
    settle('town hall summaries', () => getSummaries({ limit: 1 }), null),
    settle('mooney price', () => getMooneyPrice(), null),
  ])

  // Tableland rows have no created-at column, so "new this week" comes from
  // the NFT mint timestamps. Without them we can't tell new from old, so the
  // category is left empty rather than guessed.
  const citizenMints = mintTimestamps(citizenTransfers)
  const citizens = citizenRows
    .filter((c: any) => !BLOCKED_CITIZENS.has(c.id))
    .filter((c: any) => (citizenMints[String(c.id)] ?? 0) >= sinceTs)
    .map((c: any) => ({
      id: Number(c.id),
      name: clip(c.name, 80) || `Citizen #${c.id}`,
      location: placeName(c.location),
      bio: clip(c.description),
    }))

  const teamMints = mintTimestamps(teamTransfers)
  const teams = teamRows
    .filter((t: any) => !BLOCKED_TEAMS.has(t.id))
    .filter((t: any) => (teamMints[String(t.id)] ?? 0) >= sinceTs)
    .map((t: any) => ({
      id: Number(t.id),
      name: clip(t.name, 80) || `Team #${t.id}`,
      bio: clip(t.description),
    }))

  const jobs = jobRows
    .filter((j: any) => clip(j.title))
    .map((j: any) => ({
      id: Number(j.id),
      title: clip(j.title, 120)!,
      teamId: j.teamId != null ? Number(j.teamId) : undefined,
      description: clip(j.description),
    }))

  const listings = listingRows
    .filter((l: any) => clip(l.title))
    .map((l: any) => ({
      id: Number(l.id),
      title: clip(l.title, 120)!,
      price: l.price != null && l.price !== '' ? String(l.price) : undefined,
      currency: clip(l.currency, 12),
      teamId: l.teamId != null ? Number(l.teamId) : undefined,
      description: clip(l.description),
    }))

  const proposals = proposalRows
    .filter((p: any) => p.stage)
    .filter((p: any) => !BLOCKED_PROJECTS.has(Number(p.id)) && !BLOCKED_MDPS.has(Number(p.MDP)))
    .filter((p: any) => !isUntitledLike(p.name))
    .map((p: any) => ({ mdp: Number(p.MDP), name: clip(p.name, 120)!, status: p.stage }))

  const latest = townHalls?.summaries?.[0]
  const totalCitizens = Number(citizenCount?.[0]?.count)

  return {
    periodStart: new Date(sinceTs * 1000).toISOString(),
    periodEnd: now.toISOString(),
    citizens,
    totalCitizens: Number.isFinite(totalCitizens) && totalCitizens > 0 ? totalCitizens : null,
    teams,
    jobs,
    listings,
    proposals,
    nextTownHall: nextTownHall
      ? { name: clip(nextTownHall.name, 120)!, startAt: nextTownHall.start_at, url: nextTownHall.url }
      : null,
    latestTownHall:
      latest && new Date(latest.publishedAt).getTime() >= sinceTs * 1000
        ? {
            title: clip(latest.title, 120)!,
            publishedAt: latest.publishedAt,
            excerpt: clip(stripHtml(latest.content), 1200)!,
          }
        : null,
    mooney: mooney ? { price: mooney.price, priceChange24h: mooney.priceChange24h } : null,
  }
}
