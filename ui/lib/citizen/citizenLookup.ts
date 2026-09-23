import { CITIZEN_TABLE_NAMES } from 'const/config'
import { BLOCKED_CITIZENS } from 'const/whitelist'

export const MAX_CITIZEN_LOOKUP_ADDRESSES = 120

export type CitizenRow = {
  id: string | number
  name: string
  owner: string
  image?: string | null
}

export function isLikelyEthAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function buildCitizenOwnerLookupStatement(
  chainSlug: string,
  addresses: readonly string[]
): string | null {
  const table = CITIZEN_TABLE_NAMES[chainSlug]
  const clean = [
    ...new Set(
      addresses
        .map((address) => address.toLowerCase())
        .filter((address) => isLikelyEthAddress(address))
    ),
  ].slice(0, MAX_CITIZEN_LOOKUP_ADDRESSES)
  if (!table || clean.length === 0) return null
  const inList = clean.map((address) => `'${address}'`).join(',')
  const blocked = [...BLOCKED_CITIZENS]
  const blockedClause = blocked.length > 0 ? ` AND id NOT IN (${blocked.join(',')})` : ''
  return `SELECT id, name, owner, image FROM ${table} WHERE LOWER(owner) IN (${inList})${blockedClause}`
}

export function citizenRowsByOwner(rows: CitizenRow[] | undefined | null): Map<string, CitizenRow> {
  const map = new Map<string, CitizenRow>()
  for (const row of rows || []) {
    if (!row?.owner) continue
    map.set(String(row.owner).toLowerCase(), row)
  }
  return map
}
