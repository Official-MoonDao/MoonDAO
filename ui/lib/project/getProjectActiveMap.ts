import { PROJECT_V2_TABLE_NAMES } from 'const/config'
import queryTable from '@/lib/tableland/queryTable'

/**
 * Returns a map of `teamId` -> `active` for every project in the ProjectV2 overlay
 * table. Project-teams (projects that are teams under the hood) are gated by this
 * `active` flag instead of subscription expiry on the global jobs/marketplace pages.
 *
 * Returns an empty map when no ProjectV2 table is configured for the chain yet, in
 * which case callers fall back to treating every team as an ordinary (subscription) team.
 */
export default async function getProjectActiveMap(
  chain: any,
  chainSlug: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const tableName = PROJECT_V2_TABLE_NAMES[chainSlug]
  if (!tableName) return map
  try {
    const rows = await queryTable(
      chain,
      `SELECT teamId, active FROM ${tableName}`
    )
    for (const row of rows || []) {
      if (row?.teamId == null) continue
      map.set(String(row.teamId), Number(row.active))
    }
  } catch (err) {
    console.error('Failed to load ProjectV2 active map:', err)
  }
  return map
}
