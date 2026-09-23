//server-side only
import MarketplaceABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { Chain } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import type { TeamListing } from '@/components/subscription/TeamListing'

function teamsContract(chain: Chain) {
  return getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[getChainSlug(chain)],
    chain: chain as any,
    abi: TeamABI as any,
  })
}

/**
 * Prefer the known table name constant and avoid an RPC call on the critical
 * path. A rate-limited `getTableName()` previously took down the whole page.
 */
export async function getMarketplaceTableName(chain: Chain): Promise<string> {
  const chainSlug = getChainSlug(chain)
  const known = MARKETPLACE_TABLE_NAMES[chainSlug]
  if (known) return known

  return (await readContract({
    contract: getContract({
      client: serverClient,
      address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
      chain: chain as any,
      abi: MarketplaceABI as any,
    }),
    method: 'getTableName' as string,
    params: [],
  })) as unknown as string
}

async function getTeamExpiration(
  chain: Chain,
  teamId: any,
  retries = 3,
  delay = 500,
): Promise<number | null> {
  const contract = teamsContract(chain)
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const expiresAt = await readContract({
        contract,
        method: 'expiresAt' as string,
        params: [teamId],
      })
      return +expiresAt.toString()
    } catch (error) {
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)))
        continue
      }
      // Persistent failure (likely rate limiting). Null lets the caller fail open.
      return null
    }
  }
  return null
}

/**
 * Resolve each team's expiration once — listings frequently share a teamId, so
 * de-duping cuts RPC calls and the chance of being rate limited. Batched with a
 * small delay for the same reason.
 */
export async function resolveTeamExpirations(
  chain: Chain,
  teamIds: any[],
): Promise<Map<any, number | null>> {
  const unique = Array.from(new Set(teamIds))
  const expirations = new Map<any, number | null>()

  const BATCH_SIZE = 10
  const DELAY_BETWEEN_BATCHES = 100

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (teamId: any) => {
        expirations.set(teamId, await getTeamExpiration(chain, teamId))
      }),
    )
    if (i + BATCH_SIZE < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  return expirations
}

/**
 * Drop listings whose team subscription has lapsed. When an expiration could not
 * be resolved we fail open, so a transient RPC issue never wipes the marketplace.
 */
export async function filterListingsByActiveTeam(
  chain: Chain,
  listings: TeamListing[],
  now = Math.floor(Date.now() / 1000),
): Promise<TeamListing[]> {
  if (!listings?.length) return []
  const expirations = await resolveTeamExpirations(
    chain,
    listings.map((listing) => listing.teamId),
  )
  return listings.filter((listing) => {
    const expiration = expirations.get(listing.teamId)
    return expiration === null || expiration === undefined || expiration > now
  })
}

/** Team names are a nice-to-have label; a failure here must not discard listings. */
export async function attachTeamNames(
  chain: Chain,
  listings: TeamListing[],
): Promise<TeamListing[]> {
  const chainSlug = getChainSlug(chain)
  let teams: any[] = []
  try {
    teams = await queryTable(chain, `SELECT id, name FROM ${TEAM_TABLE_NAMES[chainSlug]}`)
  } catch (error) {
    console.error('Failed to fetch team names for marketplace listings:', error)
    return listings
  }
  return listings.map((listing) => ({
    ...listing,
    teamName: teams.find((team: any) => team.id === listing.teamId)?.name,
  }))
}

export async function fetchActiveListings(
  chain: Chain,
  now = Math.floor(Date.now() / 1000),
): Promise<TeamListing[]> {
  const tableName = await getMarketplaceTableName(chain)
  const statement = `SELECT * FROM ${tableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`
  const listings: TeamListing[] = (await queryTable(chain, statement)) || []
  const active = await filterListingsByActiveTeam(chain, listings, now)
  return attachTeamNames(chain, active)
}

/**
 * A single listing by id, regardless of its timed window — an upcoming or ended
 * listing still has a page so shared links never 404.
 */
export async function fetchListingById(chain: Chain, id: number): Promise<TeamListing | null> {
  if (!Number.isInteger(id) || id < 0) return null
  const tableName = await getMarketplaceTableName(chain)
  const rows: TeamListing[] =
    (await queryTable(chain, `SELECT * FROM ${tableName} WHERE id = ${id}`)) || []
  const listing = rows[0]
  if (!listing) return null
  const [withName] = await attachTeamNames(chain, [listing])
  return withName || listing
}

/** Other listings to surface at the bottom of a listing page: same team first. */
export async function fetchRelatedListings(
  chain: Chain,
  listing: TeamListing,
  limit = 4,
  now = Math.floor(Date.now() / 1000),
): Promise<{ listings: TeamListing[]; otherCount: number }> {
  const tableName = await getMarketplaceTableName(chain)
  const statement = `SELECT * FROM ${tableName} WHERE id != ${listing.id} AND (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`
  const rows: TeamListing[] = (await queryTable(chain, statement)) || []
  const active = await filterListingsByActiveTeam(chain, rows, now)
  const withNames = await attachTeamNames(chain, active)

  const score = (candidate: TeamListing) => (candidate.teamId === listing.teamId ? 1 : 0)
  const ranked = withNames.sort((a, b) => score(b) - score(a))

  return { listings: ranked.slice(0, limit), otherCount: ranked.length }
}
