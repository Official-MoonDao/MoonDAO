//server-side only
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_ADDRESSES, PROJECT_TABLE_NAMES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { isProposalAuthor } from '@/lib/proposals/isProposalAuthor'
import { Chain } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { isFetchableUrl } from '@/lib/utils/links'

export type ProjectSummary = {
  id: number
  name: string
  MDP: number
  active: number
  image?: string
}

export async function fetchProjectRow(
  chain: Chain,
  projectId: number
): Promise<(ProjectSummary & { proposalIPFS?: string }) | null> {
  if (!Number.isInteger(projectId) || projectId < 0) return null
  const tableName = PROJECT_TABLE_NAMES[getChainSlug(chain)]
  const rows =
    (await queryTable(
      chain,
      `SELECT id, name, MDP, active, image, proposalIPFS FROM ${tableName} WHERE id = ${projectId}`
    )) || []
  return rows[0] || null
}

export async function fetchProjectSummaries(
  chain: Chain,
  projectIds: number[]
): Promise<Map<number, ProjectSummary>> {
  const ids = Array.from(new Set(projectIds.filter((id) => Number.isInteger(id) && id >= 0)))
  const summaries = new Map<number, ProjectSummary>()
  if (!ids.length) return summaries
  const tableName = PROJECT_TABLE_NAMES[getChainSlug(chain)]
  const rows: ProjectSummary[] =
    (await queryTable(
      chain,
      `SELECT id, name, MDP, active, image FROM ${tableName} WHERE id IN (${ids.join(',')})`
    )) || []
  rows.forEach((row) => summaries.set(Number(row.id), row))
  return summaries
}

async function wearsProjectManagerHat(chain: Chain, projectId: number, wallet: string) {
  try {
    return Boolean(
      await readContract({
        contract: getContract({
          client: serverClient,
          address: PROJECT_ADDRESSES[getChainSlug(chain)],
          chain: chain as any,
          abi: ProjectABI as any,
        }),
        method: 'isManager' as string,
        params: [BigInt(projectId), wallet],
      })
    )
  } catch {
    // `isManager` reverts instead of returning false for non-wearers.
    return false
  }
}

async function fetchProposalAuthor(proposalIPFS?: string): Promise<string | undefined> {
  if (!proposalIPFS || !isFetchableUrl(proposalIPFS)) return undefined
  try {
    const res = await fetch(proposalIPFS)
    if (!res.ok) return undefined
    const json = await res.json()
    return typeof json?.authorAddress === 'string' ? json.authorAddress : undefined
  } catch {
    return undefined
  }
}

/**
 * Returns the first wallet allowed to act for the project: a wearer of the
 * project's manager hat (the project lead receives it at creation) or the
 * author recorded in the project's on-chain proposal.
 */
export async function findProjectManagerWallet(
  chain: Chain,
  project: { id: number; proposalIPFS?: string },
  wallets: string[]
): Promise<string | null> {
  for (const wallet of wallets) {
    if (await wearsProjectManagerHat(chain, project.id, wallet)) return wallet
  }
  const author = await fetchProposalAuthor(project.proposalIPFS)
  return wallets.find((wallet) => isProposalAuthor(author, wallet)) || null
}
