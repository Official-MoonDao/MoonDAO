import { readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import { getAttribute } from '@/lib/utils/nft'
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
    // `useContract` is unset on the first render, and `getNFT` throws when the
    // RPC is rate-limited. Fail open like `filterJobsByActiveTeam` so a project
    // job is not dropped before we know it is inactive.
    if (!projectContract) return true
    try {
      const nft = await getNFT({ contract: projectContract, tokenId: BigInt(owner.id) })
      return Number(getAttribute(nft?.metadata?.attributes as any, 'active')?.value) === PROJECT_ACTIVE
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
