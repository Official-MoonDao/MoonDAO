//server-side only
import { PROJECT_TABLE_NAMES } from 'const/config'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import { Chain } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { parseOwnerId } from './projectOwnerId'

export type ProjectOwnerInfo = {
  id: number
  name: string
  MDP: number
  active: number
  image: string
}

/** Project rows for every project-owned `teamId` in the list, keyed by project id. */
export async function fetchProjectOwners(
  chain: Chain,
  teamIds: Array<number | string>
): Promise<Map<number, ProjectOwnerInfo>> {
  const projectIds = Array.from(
    new Set(
      teamIds
        .map((teamId) => parseOwnerId(teamId))
        .filter((owner) => owner.kind === 'project' && Number.isInteger(owner.id))
        .map((owner) => owner.id)
    )
  )
  if (projectIds.length === 0) return new Map()

  const tableName = PROJECT_TABLE_NAMES[getChainSlug(chain)]
  const rows: ProjectOwnerInfo[] =
    (await queryTable(
      chain,
      `SELECT id, name, MDP, active, image FROM ${tableName} WHERE id IN (${projectIds.join(',')})`
    )) || []
  return new Map(rows.map((row) => [Number(row.id), row]))
}

export function isProjectActive(project: ProjectOwnerInfo | undefined): boolean {
  return Number(project?.active) === PROJECT_ACTIVE
}
