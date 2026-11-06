//server-side only
import ContributionsABI from 'const/abis/Contributions.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import {
  buildCitizenOwnerLookupStatement,
  citizenRowsByOwner,
  type CitizenRow,
} from '@/lib/citizen/citizenLookup'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import type { Contribution } from './getSheetContributions'
import { areaLabel, contributionsTable, decodeLinks, type ContributionRow } from './onchain'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

/** The cycle new submissions land in. Null until the contract is deployed. */
export async function getCurrentContributionCycle(): Promise<number | null> {
  const table = contributionsTable(chainSlug)
  if (!table) return null
  const contract = getContract({
    client: serverClient,
    address: table.address,
    chain,
    abi: ContributionsABI as any,
  })
  const cycle = await readContract({
    contract,
    method: 'currentCycleId' as string,
    params: [],
  })
  return Number(cycle)
}

/** Visible rows for one cycle, newest first. Empty when the table isn't deployed. */
export async function getContributionRows(cycleId: number): Promise<ContributionRow[]> {
  const table = contributionsTable(chainSlug)
  if (!table || !Number.isInteger(cycleId)) return []
  const rows = await queryTable(
    chain,
    `SELECT * FROM ${table.name} WHERE cycleId = ${cycleId} AND hidden = 0 ORDER BY createdAt DESC, id DESC`
  )
  return (rows ?? []) as ContributionRow[]
}

/** Visible rows from every cycle, newest first. Empty when the table isn't deployed. */
export async function getAllContributionRows(): Promise<ContributionRow[]> {
  const table = contributionsTable(chainSlug)
  if (!table) return []
  const rows = await queryTable(
    chain,
    `SELECT * FROM ${table.name} WHERE hidden = 0 ORDER BY createdAt DESC, id DESC`
  )
  return (rows ?? []) as ContributionRow[]
}

export async function getContributionRow(id: number): Promise<ContributionRow | null> {
  const table = contributionsTable(chainSlug)
  if (!table || !Number.isInteger(id) || id <= 0) return null
  const rows = await queryTable(chain, `SELECT * FROM ${table.name} WHERE id = ${id}`)
  return (rows?.[0] as ContributionRow) ?? null
}

/**
 * How many visible rows a wallet submitted through the in-app form, across
 * every cycle. Imported rows (origin 1) are left out: older history is
 * counted from the archive.
 */
export async function getOnchainContributionCount(author: string): Promise<number> {
  const table = contributionsTable(chainSlug)
  const wallet = author.trim().toLowerCase()
  if (!table || !/^0x[a-f0-9]{40}$/.test(wallet)) return 0
  const rows = await queryTable(
    chain,
    `SELECT COUNT(*) AS n FROM ${table.name} WHERE lower(author) = '${wallet}' AND hidden = 0 AND origin = 0`
  )
  return Number((rows?.[0] as { n?: unknown } | undefined)?.n ?? 0)
}

/** Citizen name and ID per author wallet, lower-cased. */
export async function getCitizensForAuthors(authors: string[]): Promise<Map<string, CitizenRow>> {
  const statement = buildCitizenOwnerLookupStatement(chainSlug, authors)
  if (!statement) return new Map()
  try {
    return citizenRowsByOwner(await queryTable(chain, statement))
  } catch (err) {
    console.error('[contributions] citizen lookup failed', err)
    return new Map()
  }
}

/** Shapes a table row like a sheet row so the feed and home activity can show both. */
export function rowToFeedContribution(row: ContributionRow, citizen?: CitizenRow): Contribution {
  const links = decodeLinks(row.links)
  return {
    timestamp: new Date(Number(row.createdAt) * 1000).toISOString(),
    walletAddress: row.author,
    name: citizen?.name || `${row.author.slice(0, 6)}…${row.author.slice(-4)}`,
    description: row.description,
    links: links[0] ?? '',
    area: areaLabel(row.area),
    id: Number(row.id),
    title: row.title,
    linkList: links,
    cycleId: Number(row.cycleId),
  }
}

/** The open cycle's rows, joined to citizen names, in feed shape. */
export async function getOnchainFeedContributions(): Promise<Contribution[]> {
  const cycleId = await getCurrentContributionCycle()
  if (cycleId == null) return []
  const rows = await getContributionRows(cycleId)
  const citizens = await getCitizensForAuthors(rows.map((r) => r.author))
  return rows.map((row) => rowToFeedContribution(row, citizens.get(row.author.toLowerCase())))
}
