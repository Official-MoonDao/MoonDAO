// Server-side only: lists recent MoonDAO activity (new citizens, teams, jobs,
// marketplace listings, contributions and Town Halls) as RSS items, straight
// from the data with no AI step. Reuses the activity summary's queries and
// helpers.
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_NAMES,
  MARKETPLACE_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_CITIZENS, BLOCKED_TEAMS } from 'const/whitelist'
import {
  clip,
  settle,
  stripHtml,
  toCitizen,
  toJob,
  toListing,
  toTeam,
} from '@/lib/activity-summary/collectActivity'
import { fetchMintTimestamps } from '@/lib/activity-summary/mintTimes'
import { getCitizensForAuthors } from '@/lib/contributions/getOnchainContributions'
import { getSheetContributions } from '@/lib/contributions/getSheetContributions'
import {
  areaLabel,
  contributionsTable,
  isSubmittedOrigin,
  type ContributionRow,
} from '@/lib/contributions/onchain'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { getSummaries } from '@/lib/townhall/summaries'
import { ContributionEntry, groupContributions, shortArea, townHallExcerpt } from './format'
import { absoluteUrl, FeedItem } from './rss'

// Longer than a week so a feed reader that polls late, or a weekly digest
// that runs a day off, still sees everything. Readers skip guids they've
// already seen, so the overlap is never sent twice.
export const FEED_LOOKBACK_DAYS = 30

function feedImage(uri: string | undefined): string | undefined {
  if (!uri) return undefined
  const url = getIPFSGateway(uri)
  return url.startsWith('https://') ? url : undefined
}

function teamSuffix(teamNames: Map<number, string>, teamId: number | undefined): string {
  const name = teamId != null ? teamNames.get(teamId) : undefined
  return name ? ` at ${name}` : ''
}

export async function collectFeedItems(now: Date = new Date()): Promise<FeedItem[]> {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const nowTs = Math.floor(now.getTime() / 1000)
  const sinceTs = nowTs - FEED_LOOKBACK_DAYS * 24 * 60 * 60
  // Contributions are grouped by week, so the oldest week in the window needs
  // the days before sinceTs too.
  const contributionsSinceTs = sinceTs - 7 * 24 * 60 * 60

  const citizenTable = CITIZEN_TABLE_NAMES[chainSlug]
  const teamTable = TEAM_TABLE_NAMES[chainSlug]
  const jobTable = JOBS_TABLE_NAMES[chainSlug]
  const marketplaceTable = MARKETPLACE_TABLE_NAMES[chainSlug]
  const contributions = contributionsTable(chainSlug)

  const [
    citizenRows,
    teamRows,
    mintTimes,
    jobRows,
    listingRows,
    contributionRows,
    sheetContributions,
    townHalls,
  ] = await Promise.all([
    settle(
      'feed citizens',
      () =>
        queryTable(
          chain,
          `SELECT id, name, description, location, image FROM ${citizenTable} WHERE view != '' ORDER BY id DESC LIMIT 80`
        ),
      [] as any[]
    ),
    settle(
      'feed teams',
      () =>
        queryTable(
          chain,
          `SELECT id, name, description, image FROM ${teamTable} ORDER BY id DESC LIMIT 30`
        ),
      [] as any[]
    ),
    // One after the other: the shared Etherscan key allows 3 calls/sec.
    settle(
      'feed mint times',
      async () => {
        const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
        const citizen = await fetchMintTimestamps({
          contractAddress: CITIZEN_ADDRESSES[chainSlug],
          chainId: chain.id,
          apiKey,
          limit: 100,
        })
        const team = await fetchMintTimestamps({
          contractAddress: TEAM_ADDRESSES[chainSlug],
          chainId: chain.id,
          apiKey,
          limit: 30,
        })
        return { citizen, team }
      },
      { citizen: null, team: null } as {
        citizen: Record<string, number> | null
        team: Record<string, number> | null
      },
      15000
    ),
    settle(
      'feed jobs',
      () =>
        queryTable(
          chain,
          `SELECT id, title, description, teamId, timestamp FROM ${jobTable} WHERE timestamp >= ${sinceTs} AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 40`
        ),
      [] as any[]
    ),
    settle(
      'feed marketplace',
      () =>
        queryTable(
          chain,
          `SELECT id, title, description, price, currency, teamId, image, timestamp FROM ${marketplaceTable} WHERE timestamp >= ${sinceTs} AND (startTime = 0 OR startTime <= ${nowTs}) AND (endTime = 0 OR endTime >= ${nowTs}) ORDER BY id DESC LIMIT 40`
        ),
      [] as any[]
    ),
    settle(
      'feed contributions',
      async () =>
        contributions
          ? ((await queryTable(
              chain,
              `SELECT id, author, title, description, area, origin, createdAt FROM ${contributions.name} WHERE hidden = 0 AND createdAt >= ${contributionsSinceTs} ORDER BY createdAt DESC, id DESC LIMIT 200`
            )) as ContributionRow[])
          : [],
      [] as ContributionRow[]
    ),
    // Most contributions so far came in through the retired Google Form;
    // /contributions still lists them alongside the onchain table.
    settle('feed sheet contributions', getSheetContributions, []),
    settle('feed town halls', () => getSummaries({ limit: 5 }), null),
  ])

  const items: FeedItem[] = []

  // Tableland rows have no created-at column, so citizens and teams are dated
  // by their NFT mint. Without mint times (Etherscan down or rate limited)
  // they're left out rather than guessed at.
  const mintDate = (mints: Record<string, number> | null, id: unknown) => {
    const ts = mints?.[String(id)]
    return ts && ts >= sinceTs ? new Date(ts * 1000) : null
  }

  for (const row of citizenRows) {
    if (BLOCKED_CITIZENS.has(row.id)) continue
    const pubDate = mintDate(mintTimes.citizen, row.id)
    if (!pubDate) continue
    const c = toCitizen(row)
    items.push({
      guid: `citizen-${c.id}`,
      title: c.location
        ? `${c.name} from ${c.location} became a citizen`
        : `${c.name} became a citizen`,
      link: absoluteUrl(`/citizen/${generatePrettyLinkWithId(c.name, c.id)}`),
      pubDate,
      category: 'Citizen',
      summary: c.bio,
      image: feedImage(c.image),
    })
  }

  const teamNames = new Map<number, string>()
  for (const row of teamRows) {
    if (BLOCKED_TEAMS.has(row.id)) continue
    const t = toTeam(row)
    teamNames.set(t.id, t.name)
    const pubDate = mintDate(mintTimes.team, row.id)
    if (!pubDate) continue
    items.push({
      guid: `team-${t.id}`,
      title: `New team: ${t.name}`,
      link: absoluteUrl(`/team/${t.id}`),
      pubDate,
      category: 'Team',
      summary: t.bio,
      image: feedImage(t.image),
    })
  }

  // Jobs and listings from teams older than the 30 most recent need their
  // names looked up separately.
  const missingTeamIds = Array.from(
    new Set(
      [...jobRows, ...listingRows]
        .map((row: any) => Number(row.teamId))
        .filter((id) => Number.isInteger(id) && !teamNames.has(id))
    )
  )
  if (missingTeamIds.length > 0) {
    const rows = await settle(
      'feed team names',
      () =>
        queryTable(
          chain,
          `SELECT id, name FROM ${teamTable} WHERE id IN (${missingTeamIds.join(',')})`
        ),
      [] as any[]
    )
    for (const row of rows) {
      const name = clip(row.name, 80)
      if (name && !BLOCKED_TEAMS.has(row.id)) teamNames.set(Number(row.id), name)
    }
  }

  for (const row of jobRows) {
    if (!clip(row.title)) continue
    const j = toJob(row)
    items.push({
      guid: `job-${j.id}`,
      title: `New job: ${j.title}${teamSuffix(teamNames, j.teamId)}`,
      link: absoluteUrl(`/jobs/${j.id}`),
      pubDate: new Date(Number(row.timestamp) * 1000),
      category: 'Job',
      summary: j.description,
    })
  }

  for (const row of listingRows) {
    if (!clip(row.title)) continue
    const l = toListing(row)
    const price = l.price ? ` (${l.price}${l.currency ? ` ${l.currency}` : ''})` : ''
    items.push({
      guid: `listing-${l.id}`,
      title: `New in the Marketplace: ${l.title}${price}${teamSuffix(teamNames, l.teamId)}`,
      link: absoluteUrl(`/marketplace/${l.id}`),
      pubDate: new Date(Number(row.timestamp) * 1000),
      category: 'Marketplace',
      summary: l.description,
      image: feedImage(l.image),
    })
  }

  const contributionEntries: ContributionEntry[] = []
  // Imported rows (backfilled from the old Google Form) aren't new activity.
  const submitted = contributionRows.filter(
    (row) => isSubmittedOrigin(row.origin) && clip(row.title)
  )
  if (submitted.length > 0) {
    const authors = await getCitizensForAuthors(submitted.map((row) => row.author))
    for (const row of submitted) {
      const citizen = authors.get(row.author.toLowerCase())
      contributionEntries.push({
        person: row.author,
        name: clip(citizen?.name, 80) || `${row.author.slice(0, 6)}…${row.author.slice(-4)}`,
        text: row.title,
        area: areaLabel(row.area),
        at: new Date(Number(row.createdAt) * 1000),
      })
    }
  }
  for (const c of sheetContributions) {
    const name = clip(c.name, 80) || 'A citizen'
    contributionEntries.push({
      person: c.walletAddress || name,
      name,
      text: c.description,
      area: shortArea(c.area),
      at: new Date(c.timestamp),
    })
  }
  items.push(...groupContributions(contributionEntries, { now, since: new Date(sinceTs * 1000) }))

  for (const summary of townHalls?.summaries ?? []) {
    const pubDate = new Date(summary.publishedAt)
    if (!(pubDate.getTime() >= sinceTs * 1000)) continue
    items.push({
      guid: `townhall-${summary.id}`,
      title: `Town Hall: ${clip(summary.title, 120)}`,
      link: absoluteUrl('/townhall'),
      pubDate,
      category: 'Town Hall',
      summary: clip(townHallExcerpt(summary.title, stripHtml(summary.content)), 400),
    })
  }

  return items
}
