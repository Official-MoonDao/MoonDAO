//server-side only
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import { Chain } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

export type ProjectTeamWallets = {
  /** projectId → lowercased wallets wearing the project's manager or member hat. */
  wallets: Record<string, string[]>
  /** Projects whose hats or wearers could not be read. */
  failedProjectIds: string[]
}

const BATCH_SIZE = 5

/**
 * Resolves the current manager- and member-hat wearers for each project.
 * Used to bar a project's team from allocating to it in the Member Vote
 * (see `lib/proposals/selfVoteExclusions.ts`). The admin hat is skipped:
 * it is worn by the team Safe, not a person.
 */
export async function fetchProjectTeamWallets(
  chain: Chain,
  projectIds: Array<string | number>
): Promise<ProjectTeamWallets> {
  const contract = getContract({
    client: serverClient,
    address: PROJECT_ADDRESSES[getChainSlug(chain)],
    chain: chain as any,
    abi: ProjectABI as any,
  })

  const wallets: Record<string, string[]> = {}
  const failedProjectIds: string[] = []

  const loadProject = async (projectId: string) => {
    try {
      const hatIds = await Promise.all(
        (['teamManagerHat', 'teamMemberHat'] as const).map((method) =>
          readContract({
            contract,
            method: method as string,
            params: [BigInt(projectId)],
          })
        )
      )
      const nonZero = hatIds.map((id: any) => BigInt(id)).filter((id) => id !== 0n)
      if (nonZero.length === 0) {
        wallets[projectId] = []
        return
      }
      const hats = await hatsSubgraphClient.getHatsByIds({
        chainId: chain.id,
        hatIds: nonZero,
        props: { wearers: { props: {} } },
      })
      const wearers = new Set<string>()
      for (const hat of hats) {
        for (const wearer of hat.wearers || []) wearers.add(wearer.id.toLowerCase())
      }
      wallets[projectId] = Array.from(wearers)
    } catch (error) {
      failedProjectIds.push(projectId)
      console.error(`[projectTeamWallets] failed to load team for project ${projectId}:`, error)
    }
  }

  const ids = Array.from(new Set(projectIds.map(String)))
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    await Promise.all(ids.slice(i, i + BATCH_SIZE).map(loadProject))
  }

  return { wallets, failedProjectIds }
}
