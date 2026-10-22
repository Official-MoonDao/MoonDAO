import { CITIZEN_TABLE_NAMES, PROJECT_TABLE_NAMES, TEAM_TABLE_NAMES } from 'const/config'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import { parseOwnerId } from '@/lib/project/projectOwnerId'
import type { Chain } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { citizenRowToNFT, teamRowToNFT } from './convertRow'

const SAFE_TABLE = /^[A-Za-z0-9_]+$/
const SAFE_ADDRESS = /^0x[a-fA-F0-9]{40}$/

export type ProjectActiveStatus = 'active' | 'inactive' | 'unknown'

function safeTable(name: string | undefined): string | null {
  if (!name || !SAFE_TABLE.test(name)) return null
  return name
}

function safeId(id: number | string | bigint): number | null {
  const value = typeof id === 'bigint' ? Number(id) : Number(id)
  if (!Number.isSafeInteger(value) || value < 0) return null
  return value
}

function withStringId(nft: any, id: number | string) {
  const idString = String(id)
  return {
    ...nft,
    id: idString,
    metadata: { ...nft.metadata, id: idString },
  }
}

/** Project rows have no token metadata. Shape them like the old NFT so callers can keep reading attributes. */
export function projectRowToNFT(row: Record<string, unknown>) {
  const id = row.id ?? ''
  return {
    id,
    metadata: {
      id: id === '' ? '' : String(id),
      uri: '',
      name: typeof row.name === 'string' ? row.name : '',
      description: '',
      image: typeof row.image === 'string' ? row.image : '',
      animation_url: '',
      external_url: '',
      attributes: [
        { trait_type: 'MDP', value: row.MDP ?? '' },
        { trait_type: 'active', value: row.active ?? '' },
      ],
    },
    owner: '',
    tokenURI: '',
    type: 'ERC721',
  }
}

export function ownerProfileStatement(
  chainSlug: string,
  teamId: number | string | bigint
): string | null {
  const owner = parseOwnerId(teamId)
  const id = safeId(owner.id)
  if (id === null) return null
  const tableName = safeTable(
    owner.kind === 'project' ? PROJECT_TABLE_NAMES[chainSlug] : TEAM_TABLE_NAMES[chainSlug]
  )
  if (!tableName) return null
  return `SELECT * FROM ${tableName} WHERE id = ${id} LIMIT 1`
}

export function teamNamesStatement(
  chainSlug: string,
  teamIds: readonly (number | string | bigint)[]
): string | null {
  const ids = Array.from(
    new Set(teamIds.map((id) => safeId(id)).filter((id): id is number => id !== null))
  )
  if (!ids.length) return null
  const tableName = safeTable(TEAM_TABLE_NAMES[chainSlug])
  if (!tableName) return null
  return `SELECT id, name FROM ${tableName} WHERE id IN (${ids.join(',')})`
}

export function citizenByIdStatement(
  chainSlug: string,
  tokenId: number | string | bigint
): string | null {
  const id = safeId(tokenId)
  const tableName = safeTable(CITIZEN_TABLE_NAMES[chainSlug])
  if (id === null || !tableName) return null
  return `SELECT * FROM ${tableName} WHERE id = ${id} LIMIT 1`
}

export function citizenByOwnerStatement(chainSlug: string, address: string): string | null {
  if (!SAFE_ADDRESS.test(address)) return null
  const tableName = safeTable(CITIZEN_TABLE_NAMES[chainSlug])
  if (!tableName) return null
  return `SELECT * FROM ${tableName} WHERE LOWER(owner) = '${address.toLowerCase()}' LIMIT 1`
}

export function projectActiveStatement(
  chainSlug: string,
  projectId: number | string | bigint
): string | null {
  const id = safeId(projectId)
  const tableName = safeTable(PROJECT_TABLE_NAMES[chainSlug])
  if (id === null || !tableName) return null
  return `SELECT active FROM ${tableName} WHERE id = ${id} LIMIT 1`
}

export function projectActiveFromRows(rows: unknown): ProjectActiveStatus {
  if (!Array.isArray(rows)) return 'unknown'
  if (!rows.length) return 'inactive'
  return Number(rows[0]?.active) === PROJECT_ACTIVE ? 'active' : 'inactive'
}

export function teamNameMapFromRows(rows: unknown): Map<string, string> {
  const names = new Map<string, string>()
  if (!Array.isArray(rows)) return names
  for (const row of rows) {
    const name = typeof row?.name === 'string' ? row.name.trim() : ''
    if (!name || row?.id === undefined || row?.id === null) continue
    names.set(String(row.id), name)
  }
  return names
}

export function ownerNftFromRows(rows: unknown, teamId: number | string | bigint) {
  if (!Array.isArray(rows) || !rows[0]) return null
  const owner = parseOwnerId(teamId)
  const nft = owner.kind === 'project' ? projectRowToNFT(rows[0]) : teamRowToNFT(rows[0])
  return withStringId(nft, rows[0].id ?? owner.id)
}

export function citizenNftFromRows(rows: unknown) {
  if (!Array.isArray(rows) || !rows[0]) return null
  return withStringId(citizenRowToNFT(rows[0]), rows[0].id)
}

export async function queryTableClient(chain: Chain, statement: string): Promise<unknown[] | null> {
  try {
    const chainSlug = getChainSlug(chain)
    const response = await fetch(
      `/api/tableland/query?statement=${encodeURIComponent(statement)}&chain=${encodeURIComponent(
        chainSlug
      )}`
    )
    if (!response.ok) return null
    const rows = await response.json()
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

/** Team or project profile behind a jobs/marketplace `teamId`. Names live in our tables, not tokenURI. */
export async function loadOwnerNft(chain: Chain, teamId: number | string | bigint) {
  const statement = ownerProfileStatement(getChainSlug(chain), teamId)
  if (!statement) return null
  return ownerNftFromRows(await queryTableClient(chain, statement), teamId)
}

export async function loadTeamNames(
  chain: Chain,
  teamIds: readonly (number | string | bigint)[]
): Promise<Map<string, string>> {
  const statement = teamNamesStatement(getChainSlug(chain), teamIds)
  if (!statement) return new Map()
  return teamNameMapFromRows(await queryTableClient(chain, statement))
}

export async function loadCitizenNft(chain: Chain, tokenId: number | string | bigint) {
  const statement = citizenByIdStatement(getChainSlug(chain), tokenId)
  if (!statement) return null
  return citizenNftFromRows(await queryTableClient(chain, statement))
}

export async function loadCitizenByOwner(chain: Chain, address: string) {
  const statement = citizenByOwnerStatement(getChainSlug(chain), address)
  if (!statement) return null
  return citizenNftFromRows(await queryTableClient(chain, statement))
}

export async function loadProjectActiveStatus(
  chain: Chain,
  projectId: number | string | bigint
): Promise<ProjectActiveStatus> {
  const statement = projectActiveStatement(getChainSlug(chain), projectId)
  if (!statement) return 'unknown'
  const rows = await queryTableClient(chain, statement)
  if (!rows) return 'unknown'
  return projectActiveFromRows(rows)
}
