import { readContract } from 'thirdweb'
import { loadProjectActiveStatus } from '@/lib/tableland/tableNft'
import { parseOwnerId } from './projectOwnerId'

/**
 * Client-side counterpart of the server filters in `lib/jobs/jobsTable.ts` and
 * `lib/marketplace/marketplaceTable.ts`: team rows need a live subscription,
 * project jobs need an active project, project listings always pass.
 */
export async function isOwnerActive({
  teamId,
  kind,
  teamContract,
  projectContract,
  now = Math.floor(Date.now() / 1000),
}: {
  teamId: number | string
  kind: 'job' | 'listing'
  teamContract: any
  projectContract?: any
  now?: number
}): Promise<boolean> {
  const owner = parseOwnerId(teamId)
  if (owner.kind === 'project') {
    if (kind === 'listing') return true
    // A failed table read must not hide a project job. The server filter does
    // the same when project status cannot be loaded.
    const chain = projectContract?.chain || teamContract?.chain
    if (!chain) return true
    try {
      const status = await loadProjectActiveStatus(chain, owner.id)
      if (status === 'unknown') return true
      return status === 'active'
    } catch (error) {
      console.error('Failed to read project status for job:', error)
      return true
    }
  }
  try {
    const expiresAt = await readContract({
      contract: teamContract,
      method: 'expiresAt' as string,
      params: [owner.id],
    })
    return +expiresAt.toString() > now
  } catch {
    return false
  }
}
