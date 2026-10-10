//server-side only
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { Chain } from '@/lib/rpc/chains'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { fetchProjectRow } from './projectAccess'
import { ownerFallbackName, ownerHref, parseOwnerId } from './projectOwnerId'

export type OwnerSummary = {
  id: number
  name: string
  image: string
  /** The team's or project's Safe, which receives marketplace payments. */
  owner: string
  href: string
}

/** Display data for the team or project behind a jobs/marketplace `teamId`. */
export async function loadOwnerSummary(
  chain: Chain,
  teamId: number,
  { prettyTeamLink = false }: { prettyTeamLink?: boolean } = {}
): Promise<OwnerSummary | null> {
  const ref = parseOwnerId(teamId)

  if (ref.kind === 'project') {
    const project = await fetchProjectRow(chain, ref.id)
    if (!project) return null
    let owner = ''
    try {
      owner = (await readContract({
        contract: getContract({
          client: serverClient,
          address: PROJECT_ADDRESSES[getChainSlug(chain)],
          chain: chain as any,
          abi: ProjectABI as any,
        }),
        method: 'ownerOf' as string,
        params: [BigInt(ref.id)],
      })) as string
    } catch {
      // The buy modal falls back to its own owner lookup.
    }
    return {
      id: teamId,
      name: project.name || ownerFallbackName(teamId),
      image: project.image || '',
      owner,
      href: ownerHref(teamId, { projectMDP: project.MDP }),
    }
  }

  const { fetchTeamWithOwner } = await import('@/lib/team/teamDataService')
  const team = await fetchTeamWithOwner(chain, teamId)
  if (!team) return null
  const name = (team.metadata?.name as string) || `Team #${teamId}`
  return {
    id: teamId,
    name,
    image: (team.metadata?.image as string) || '',
    owner: (team as any).owner || '',
    href: ownerHref(teamId, {
      teamSlug: prettyTeamLink && team.metadata?.name ? generatePrettyLink(name) : undefined,
    }),
  }
}
