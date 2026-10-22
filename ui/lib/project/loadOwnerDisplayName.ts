import { PROJECT_TABLE_NAMES, TEAM_TABLE_NAMES } from 'const/config'
import type { Chain } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { ownerFallbackName, parseOwnerId } from './projectOwnerId'

const SAFE_TABLE = /^[A-Za-z0-9_]+$/

/**
 * Team and project tokenURIs still point at tableland.network. That host no
 * longer returns metadata, so `getNFT().metadata.name` is undefined and Discord
 * announcements render the word "undefined". Names live in our own tables.
 */
export function ownerNameStatement(
  chainSlug: string,
  teamId: number | string | bigint
): string | null {
  const owner = parseOwnerId(teamId)
  if (!Number.isSafeInteger(owner.id) || owner.id < 0) return null
  const tableName =
    owner.kind === 'project' ? PROJECT_TABLE_NAMES[chainSlug] : TEAM_TABLE_NAMES[chainSlug]
  if (!tableName || !SAFE_TABLE.test(tableName)) return null
  return `SELECT name FROM ${tableName} WHERE id = ${owner.id} LIMIT 1`
}

export function ownerNameFromRows(rows: unknown, teamId: number | string | bigint): string {
  const fallback = ownerFallbackName(teamId)
  if (!Array.isArray(rows) || rows.length === 0) return fallback
  const name = rows[0]?.name
  if (typeof name !== 'string') return fallback
  const trimmed = name.trim()
  return trimmed || fallback
}

export async function loadOwnerDisplayName(
  chain: Chain,
  teamId: number | string | bigint
): Promise<string> {
  const fallback = ownerFallbackName(teamId)
  const chainSlug = getChainSlug(chain)
  const statement = ownerNameStatement(chainSlug, teamId)
  if (!statement) return fallback

  try {
    const response = await fetch(
      `/api/tableland/query?statement=${encodeURIComponent(statement)}&chain=${encodeURIComponent(
        chainSlug
      )}`
    )
    if (!response.ok) return fallback
    return ownerNameFromRows(await response.json(), teamId)
  } catch {
    return fallback
  }
}
