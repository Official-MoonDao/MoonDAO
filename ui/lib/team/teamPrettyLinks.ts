/**
 * Server-side pretty-link resolver for teams.
 *
 * Resolving a pretty link (e.g. `/team/aethero`) requires the full set of
 * team names so we can apply the same de-duplication rules as
 * `generatePrettyLinks`. That query is expensive — it goes through the
 * Tableland SDK on every server render — so we keep an in-process cache
 * with a short TTL and a single in-flight refresh promise.
 *
 * On refresh failure we keep serving the previous snapshot so a transient
 * Tableland blip doesn't 404 every team page at once.
 */
import { TEAM_TABLE_NAMES } from 'const/config'
import { Chain } from 'thirdweb'
import { generatePrettyLinks } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

const CACHE_TTL_MS = 60_000
const STALE_TTL_MS = 10 * 60_000

type PrettyLinksSnapshot = {
  prettyLinks: Record<string, string | number>
  fetchedAt: number
}

const snapshotByChainSlug = new Map<string, PrettyLinksSnapshot>()
const inflightByChainSlug = new Map<string, Promise<PrettyLinksSnapshot>>()

async function refreshSnapshot(
  chain: Chain,
  chainSlug: string,
  tableName: string
): Promise<PrettyLinksSnapshot> {
  const rows = (await queryTable(
    chain,
    `SELECT id, name FROM ${tableName}`
  )) as Array<{ id: string | number; name: string }>

  const { prettyLinks } = generatePrettyLinks(rows || [])

  const snapshot: PrettyLinksSnapshot = {
    prettyLinks,
    fetchedAt: Date.now(),
  }
  snapshotByChainSlug.set(chainSlug, snapshot)
  return snapshot
}

async function getSnapshot(chain: Chain): Promise<PrettyLinksSnapshot | null> {
  const chainSlug = getChainSlug(chain)
  const tableName = TEAM_TABLE_NAMES[chainSlug]

  if (!tableName) return null

  const cached = snapshotByChainSlug.get(chainSlug)
  const now = Date.now()

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  let inflight = inflightByChainSlug.get(chainSlug)
  if (!inflight) {
    inflight = refreshSnapshot(chain, chainSlug, tableName).finally(() => {
      inflightByChainSlug.delete(chainSlug)
    })
    inflightByChainSlug.set(chainSlug, inflight)
  }

  try {
    return await inflight
  } catch (error) {
    console.error(
      `Failed to refresh team pretty-links for ${chainSlug}:`,
      (error as Error)?.message || error
    )
    if (cached && now - cached.fetchedAt < STALE_TTL_MS) {
      return cached
    }
    return null
  }
}

/**
 * Resolve a pretty-link slug (e.g. "aethero") to a numeric team id.
 * Returns `null` if the slug doesn't map to a known team.
 *
 * If the underlying Tableland query is failing and we have no usable cache,
 * the caller will get `null`. They should treat that as "could not resolve"
 * (and probably 404) rather than retrying inline.
 */
export async function resolveTeamIdFromPrettyLink(
  chain: Chain,
  slug: string
): Promise<string | number | null> {
  const snapshot = await getSnapshot(chain)
  if (!snapshot) return null
  const id = snapshot.prettyLinks[slug.toLowerCase()]
  return id ?? null
}
