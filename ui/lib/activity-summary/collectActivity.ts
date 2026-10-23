// Server-side only: gathers the past week of MoonDAO activity into a compact
// snapshot that the activity summary prompt is built from.
import ProposalsABI from 'const/abis/Proposals.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_NAMES,
  MARKETPLACE_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_CITIZENS, BLOCKED_TEAMS } from 'const/whitelist'
import { getContract, readContract } from 'thirdweb'
import { parseLocationData } from '@/lib/citizen/citizenDataService'
import { getMooneyPrice } from '@/lib/coinstats'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import { getLivePhaseOverride, resolveLivePhase } from '@/lib/operator/cyclePhase'
import {
  getProjectDisplayName,
  isUntitledLike,
  UNTITLED_FALLBACK,
} from '@/lib/project/getProjectDisplayName'
import { excludeNonProjectProposals } from '@/lib/project/excludeNonProjectProposals'
import { isBlockedProject } from '@/lib/project/isBlockedProject'
import { getProposalCycle } from '@/lib/projectCycle/cycleQuarters'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { getNextTownHallEvent, getUpcomingLumaEvents } from '@/lib/townhall/luma'
import { getSummaries } from '@/lib/townhall/summaries'
import { fetchMintTimestamps } from './mintTimes'
import { pickForDay } from './spotlight'

export const LOOKBACK_DAYS = 7

// User-submitted text (bios, descriptions) is clipped before it reaches the
// model to keep the prompt small and limit what any one row can inject.
const TEXT_LIMIT = 280
const SOURCE_TIMEOUT_MS = 8000
const MINT_TIMES_TIMEOUT_MS = 15000

export type ProposalStage = 'member-vote' | 'senate-review'

// `image` is an ipfs:// or https:// URI for the card's avatars. It is never
// sent to the model.
type CitizenItem = { id: number; name: string; location?: string; bio?: string; image?: string }
type TeamItem = { id: number; name: string; bio?: string; image?: string }
type JobItem = { id: number; title: string; teamId?: number; description?: string }
type ListingItem = {
  id: number
  title: string
  price?: string
  currency?: string
  teamId?: number
  description?: string
  image?: string
}
type ProjectItem = { mdp: number; name: string; description?: string; image?: string }
type EventItem = {
  id: string
  name: string
  startAt: string
  url: string
  image?: string
  guestCount?: number
}

export type ActivitySnapshot = {
  periodStart: string
  periodEnd: string
  citizens: CitizenItem[]
  totalCitizens: number | null
  teams: TeamItem[]
  jobs: JobItem[]
  listings: ListingItem[]
  // 'member-vote': passed the Senate, citizens can vote now.
  // 'senate-review': waiting on the Senate's temperature check.
  proposals: { mdp: number; name: string; status: ProposalStage }[]
  // Up to 3 upcoming Luma events, soonest first.
  upcomingEvents: EventItem[]
  latestTownHall: { title: string; publishedAt: string; excerpt: string } | null
  mooney: { price: number; priceChange24h: number } | null
  // Featured items for categories with nothing new this week, picked by
  // pickForDay. A key is only set when its category above is empty: a
  // citizen spotlight when no one joined, a funded project when no vote is
  // open, and so on.
  spotlight: {
    citizen?: CitizenItem
    team?: TeamItem
    job?: JobItem
    listing?: ListingItem
    project?: ProjectItem
  }
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
async function settle<T>(
  label: string,
  work: () => Promise<T>,
  fallback: T,
  timeoutMs = SOURCE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[activity-summary] ${label} timed out`)
      resolve(fallback)
    }, timeoutMs)
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

const IPFS_TIMEOUT_MS = 4000

/**
 * The proposals citizens can act on right now. Mirrors the proposal list on
 * /projects (pages/projects/index.tsx): pending rows in the current proposal
 * cycle, minus blocked, author-deleted, non-project and Senate-rejected ones.
 * On top of that, the live cycle phase decides what counts as open:
 *  - Member Vote: only Senate-approved proposals ('member-vote')
 *  - Senate Vote: proposals awaiting the temp check ('senate-review')
 *  - intake / idle: none
 */
async function fetchOpenProposals(projectTable: string): Promise<ActivitySnapshot['proposals']> {
  const phase = resolveLivePhase(await getLivePhaseOverride())
  if (phase !== 'member' && phase !== 'senate') return []

  const { quarter, year } = getProposalCycle()
  const rows: any[] =
    (await queryTable(
      DEFAULT_CHAIN_V5,
      `SELECT id, MDP, name, proposalIPFS FROM ${projectTable} WHERE active = ${PROJECT_PENDING} AND quarter = ${quarter} AND year = ${year}`
    )) || []
  const pending = rows.filter((row) => !isBlockedProject(row))

  const contract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)],
    abi: ProposalsABI.abi as any,
    chain: DEFAULT_CHAIN_V5,
  })

  const results = await Promise.all(
    pending.map(async (row) => {
      // Flags decide whether the proposal is in this phase's vote at all, so
      // a failed read leaves the proposal out instead of guessing.
      let approved: unknown
      let failed: unknown
      try {
        ;[approved, failed] = await Promise.all([
          readContract({ contract, method: 'tempCheckApproved' as string, params: [row.MDP] }),
          readContract({ contract, method: 'tempCheckFailed' as string, params: [row.MDP] }),
        ])
      } catch (error) {
        console.error(`[activity-summary] proposal flags for MDP ${row.MDP} failed:`, error)
        return null
      }
      if (failed) return null
      const stage: ProposalStage = approved ? 'member-vote' : 'senate-review'
      if ((phase === 'member') !== (stage === 'member-vote')) return null

      // Like /projects, an unreachable IPFS gateway doesn't drop a proposal.
      let name = row.name
      try {
        const res = await fetch(row.proposalIPFS, {
          signal: AbortSignal.timeout(IPFS_TIMEOUT_MS),
        })
        const json = await res.json()
        if (json?.nonProjectProposal || json?.deleted) return null
        if (isUntitledLike(name)) {
          const resolved = getProjectDisplayName(row, json)
          if (resolved !== UNTITLED_FALLBACK) name = resolved
        }
      } catch {
        // keep the stored name
      }

      return { mdp: Number(row.MDP), name: clip(name, 120) || `MDP-${row.MDP}`, status: stage }
    })
  )

  return results
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.mdp - b.mdp)
}

// null = couldn't be read (see fetchMintTimestamps)
type MintTimes = { citizen: Record<string, number> | null; team: Record<string, number> | null }

export function safeImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.startsWith('ipfs://') || trimmed.startsWith('https://') ? trimmed : undefined
}

function toCitizen(c: any): CitizenItem {
  return {
    id: Number(c.id),
    name: clip(c.name, 80) || `Citizen #${c.id}`,
    location: placeName(c.location),
    bio: clip(c.description),
    image: safeImage(c.image),
  }
}

function toTeam(t: any): TeamItem {
  return {
    id: Number(t.id),
    name: clip(t.name, 80) || `Team #${t.id}`,
    bio: clip(t.description),
    image: safeImage(t.image),
  }
}

function toJob(j: any): JobItem {
  return {
    id: Number(j.id),
    title: clip(j.title, 120)!,
    teamId: j.teamId != null ? Number(j.teamId) : undefined,
    description: clip(j.description),
  }
}

function toListing(l: any): ListingItem {
  return {
    id: Number(l.id),
    title: clip(l.title, 120)!,
    price: l.price != null && l.price !== '' ? String(l.price) : undefined,
    currency: clip(l.currency, 12),
    teamId: l.teamId != null ? Number(l.teamId) : undefined,
    description: clip(l.description),
    image: safeImage(l.image),
  }
}

// Scrapes the public Luma calendar (no API key); falls back to the Luma API
// when the page can't be read and LUMA_API_KEY is set.
async function fetchUpcomingEvents(): Promise<EventItem[]> {
  try {
    const events = await getUpcomingLumaEvents(3)
    return events.map((e) => ({
      id: e.id,
      name: clip(e.name, 120)!,
      startAt: e.startAt,
      url: e.url,
      image: e.coverUrl,
      guestCount: e.guestCount,
    }))
  } catch (error) {
    console.warn('[activity-summary] Luma calendar page failed, trying the API:', error)
    const next = await getNextTownHallEvent()
    return next
      ? [
          {
            id: next.id,
            name: clip(next.name, 120)!,
            startAt: next.start_at,
            url: next.url,
            image: safeImage(next.cover_url),
          },
        ]
      : []
  }
}

/**
 * Picks a featured item for each category that has nothing new this week,
 * like the Python Discord brief's citizen spotlight and featured job/listing.
 * Pools favour items worth featuring: citizens and teams with a bio, jobs and
 * listings that are still open, and funded (active) projects.
 */
async function collectSpotlights(params: {
  now: Date
  nowTs: number
  tables: {
    citizenTable: string
    teamTable: string
    jobTable: string
    marketplaceTable: string
    projectTable: string
  }
  need: Record<keyof ActivitySnapshot['spotlight'], boolean>
}): Promise<ActivitySnapshot['spotlight']> {
  const { now, nowTs, tables, need } = params
  const chain = DEFAULT_CHAIN_V5
  const query = (label: string, sql: string) =>
    settle(`${label} spotlight`, () => queryTable(chain, sql), [] as any[])
  const none = Promise.resolve([] as any[])

  const [citizenPool, teamPool, jobPool, listingPool, projectPool] = await Promise.all([
    need.citizen
      ? query(
          'citizen',
          `SELECT id, name, description, location, image FROM ${tables.citizenTable} WHERE view != '' AND description != '' ORDER BY id DESC LIMIT 100`
        )
      : none,
    need.team
      ? query(
          'team',
          `SELECT id, name, description, image FROM ${tables.teamTable} WHERE description != '' ORDER BY id DESC LIMIT 100`
        )
      : none,
    need.job
      ? query(
          'job',
          `SELECT id, title, description, teamId FROM ${tables.jobTable} WHERE (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 50`
        )
      : none,
    need.listing
      ? query(
          'listing',
          `SELECT id, title, description, price, currency, teamId, image FROM ${tables.marketplaceTable} WHERE (startTime = 0 OR startTime <= ${nowTs}) AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 50`
        )
      : none,
    // Passed governance proposals share the active flag with funded projects;
    // drop them the same way the dashboard and /projects do.
    need.project
      ? settle(
          'project spotlight',
          async () =>
            excludeNonProjectProposals(
              await queryTable(
                chain,
                `SELECT id, MDP, name, description, image, proposalIPFS FROM ${tables.projectTable} WHERE active = ${PROJECT_ACTIVE}`
              )
            ),
          [] as any[]
        )
      : none,
  ])

  const citizen = pickForDay<CitizenItem>(
    citizenPool.filter((c: any) => !BLOCKED_CITIZENS.has(c.id)).map(toCitizen),
    now,
    0
  )
  const team = pickForDay<TeamItem>(
    teamPool.filter((t: any) => !BLOCKED_TEAMS.has(t.id)).map(toTeam),
    now,
    1
  )
  const job = pickForDay<JobItem>(jobPool.filter((j: any) => clip(j.title)).map(toJob), now, 2)
  const listing = pickForDay<ListingItem>(listingPool.filter((l: any) => clip(l.title)).map(toListing), now, 3)
  const projectRow = pickForDay<{ id: number; MDP: number; name: string; description?: string; image?: string }>(
    projectPool
      .filter((p: any) => !isBlockedProject(p) && !isUntitledLike(p.name))
      .map((p: any) => ({ ...p, id: Number(p.id) })),
    now,
    4
  )

  return {
    ...(citizen && { citizen }),
    ...(team && { team }),
    ...(job && { job }),
    ...(listing && { listing }),
    ...(projectRow && {
      project: {
        mdp: Number(projectRow.MDP),
        name: clip(projectRow.name, 120)!,
        description: clip(projectRow.description),
        image: safeImage(projectRow.image),
      },
    }),
  }
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
    mintTimes,
    teamRows,
    jobRows,
    listingRows,
    proposals,
    upcomingEvents,
    townHalls,
    mooney,
  ] = await Promise.all([
    settle(
      'citizens',
      () =>
        queryTable(
          chain,
          `SELECT id, name, description, location, image FROM ${citizenTable} ${citizenWhere} ORDER BY id DESC LIMIT 25`
        ),
      [] as any[]
    ),
    settle(
      'citizen count',
      () => queryTable(chain, `SELECT COUNT(*) as count FROM ${citizenTable} ${citizenWhere}`),
      [] as any[]
    ),
    // Citizen then team, one after the other: the shared Etherscan key
    // allows 3 calls/sec, and fetchMintTimestamps may retry. Gets a longer
    // limit than other sources to leave room for those retries.
    settle(
      'mint times',
      async () => {
        const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
        const citizen = await fetchMintTimestamps({
          contractAddress: CITIZEN_ADDRESSES[chainSlug],
          chainId: chain.id,
          apiKey,
          limit: 50,
        })
        const team = await fetchMintTimestamps({
          contractAddress: TEAM_ADDRESSES[chainSlug],
          chainId: chain.id,
          apiKey,
          limit: 20,
        })
        return { citizen, team }
      },
      { citizen: null, team: null } as MintTimes,
      MINT_TIMES_TIMEOUT_MS
    ),
    settle(
      'teams',
      () =>
        queryTable(chain, `SELECT id, name, description, image FROM ${teamTable} ORDER BY id DESC LIMIT 15`),
      [] as any[]
    ),
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
          `SELECT id, title, description, price, currency, teamId, image FROM ${marketplaceTable} WHERE timestamp >= ${sinceTs} AND (startTime = 0 OR startTime <= ${nowTs}) AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 20`
        ),
      [] as any[]
    ),
    settle('proposals', () => fetchOpenProposals(projectTable), [] as ActivitySnapshot['proposals']),
    settle('upcoming events', fetchUpcomingEvents, [] as EventItem[]),
    settle('town hall summaries', () => getSummaries({ limit: 1 }), null),
    settle('mooney price', () => getMooneyPrice(), null),
  ])

  // Tableland rows have no created-at column, so "new this week" comes from
  // the NFT mint timestamps. When those can't be read (null), we can't tell
  // new from old: the category gets neither new items nor a spotlight, since
  // a spotlight would imply nobody joined.
  const isNew = (mints: Record<string, number> | null, id: unknown) =>
    mints !== null && (mints[String(id)] ?? 0) >= sinceTs
  const citizens = citizenRows
    .filter((c: any) => !BLOCKED_CITIZENS.has(c.id))
    .filter((c: any) => isNew(mintTimes.citizen, c.id))
    .map(toCitizen)
  const teams = teamRows
    .filter((t: any) => !BLOCKED_TEAMS.has(t.id))
    .filter((t: any) => isNew(mintTimes.team, t.id))
    .map(toTeam)
  if (mintTimes.citizen === null) console.warn('[activity-summary] citizen mint times unavailable')
  if (mintTimes.team === null) console.warn('[activity-summary] team mint times unavailable')

  const jobs = jobRows.filter((j: any) => clip(j.title)).map(toJob)
  const listings = listingRows.filter((l: any) => clip(l.title)).map(toListing)

  const spotlight = await collectSpotlights({
    now,
    nowTs,
    tables: { citizenTable, teamTable, jobTable, marketplaceTable, projectTable },
    need: {
      citizen: mintTimes.citizen !== null && citizens.length === 0,
      team: mintTimes.team !== null && teams.length === 0,
      job: jobs.length === 0,
      listing: listings.length === 0,
      project: proposals.length === 0,
    },
  })

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
    upcomingEvents,
    latestTownHall:
      latest && new Date(latest.publishedAt).getTime() >= sinceTs * 1000
        ? {
            title: clip(latest.title, 120)!,
            publishedAt: latest.publishedAt,
            excerpt: clip(stripHtml(latest.content), 1200)!,
          }
        : null,
    mooney: mooney ? { price: mooney.price, priceChange24h: mooney.priceChange24h } : null,
    spotlight,
  }
}
