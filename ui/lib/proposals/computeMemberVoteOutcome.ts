/**
 * Read-only counterpart to `pages/api/proposals/vote.ts`.
 *
 * Replays the same quadratic-voting pipeline used at tally-time so the
 * outcome can be displayed on `/projects` (and previewed by the EB before
 * they trigger the on-chain close) WITHOUT touching the chain or doing the
 * heavier Safe-multisig audit.
 *
 * Differences vs. the POST handler:
 *   - No `updateTableCol` writes (it's purely a computation).
 *   - No multisig audit (advisory only at tally time; not needed for display).
 *   - No `currentTimestamp <= voteCloseTimestamp` guard. We always project
 *     vMOONEY at `voteCloseTimestamp`, so live previews during voting are
 *     consistent with what the tally will produce.
 *   - Returns `null` on the "no votes / no eligible projects" cases instead
 *     of throwing, so callers can treat it as "nothing to show".
 *
 * Keep this in sync with `pages/api/proposals/vote.ts` if the tally math
 * changes — it intentionally mirrors that file's normalization → quadratic
 * voting → top-half-with-budget-cap pipeline.
 */
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  PROPOSALS_TABLE_NAMES,
  NEXT_QUARTER_BUDGET_USD,
} from 'const/config'
import { readContract, getContract } from 'thirdweb'
import { getThirdThursdayOfQuarterTimestamp } from '@/lib/utils/dates'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import {
  runQuadraticVoting,
  runIterativeNormalization,
  getApprovedProjects,
} from '@/lib/utils/rewards'

export type MemberVoteResult = {
  rank: number
  projectId: string
  MDP: number | string | null
  name: string
  percentage: number
  approved: boolean
  budget: number
}

export type MemberVoteOutcome = {
  quarter: number
  year: number
  voteCount: number
  voterCount: number
  voteOpenTimestamp: number
  voteCloseTimestamp: number
  totalVotingPower: number
  quarterBudgetUsd: number
  results: MemberVoteResult[]
  computedAt: number
}

// Mirror of the same retry helper inside the POST handler — RPC reads against
// the Proposals contract occasionally come back as undefined buffers and a
// single retry usually clears it. Keep this local so we don't pull a Next API
// route into a shared lib.
async function readContractWithRetry<T>(
  contract: any,
  method: string,
  params: any[],
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await readContract({ contract, method, params })
      return result as T
    } catch (error) {
      lastError = error
      const isRetryableError =
        error instanceof TypeError &&
        String(error.message).includes('buffer')
      if (!isRetryableError || attempt === maxRetries - 1) {
        throw error
      }
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

export async function computeMemberVoteOutcome({
  chain,
  quarter,
  year,
}: {
  chain: any
  quarter: number
  year: number
}): Promise<MemberVoteOutcome | null> {
  if (
    !Number.isInteger(quarter) ||
    !Number.isInteger(year) ||
    quarter < 1 ||
    quarter > 4 ||
    year < 2020
  ) {
    return null
  }

  const chainSlug = getChainSlug(chain)
  const proposalsTableName = PROPOSALS_TABLE_NAMES[chainSlug]
  const projectTableName = PROJECT_TABLE_NAMES[chainSlug]
  const proposalsContractAddress = PROPOSALS_ADDRESSES[chainSlug]
  if (!proposalsTableName || !projectTableName || !proposalsContractAddress) {
    return null
  }

  const voteStatement = `SELECT * FROM ${proposalsTableName} WHERE quarter = ${quarter} AND year = ${year}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  if (!votes || votes.length === 0) return null
  const voteAddresses = votes.map((pv) => pv.address)

  const projectStatement = `SELECT * FROM ${projectTableName} WHERE QUARTER = ${quarter} AND YEAR = ${year}`
  const projects = (await queryTable(chain, projectStatement)) || []
  if (!projects.length) return null

  const proposalContract = getContract({
    client: serverClient,
    address: proposalsContractAddress,
    abi: ProposalsABI.abi as any,
    chain,
  })

  // Filter to senate-approved projects (`tempCheckApproved` on-chain). Mirror
  // the POST handler's sequential read pattern to avoid hammering the RPC.
  const passedProjects: any[] = []
  for (const project of projects) {
    if (project.MDP === undefined || project.MDP === null) continue
    try {
      const approved = await readContractWithRetry<boolean>(
        proposalContract,
        'tempCheckApproved',
        [project.MDP]
      )
      if (approved) passedProjects.push(project)
    } catch (error) {
      console.error(
        '[computeMemberVoteOutcome] tempCheckApproved read failed:',
        { projectId: project.id, MDP: project.MDP, error }
      )
    }
  }
  if (passedProjects.length === 0) return null

  // USD budgets pulled from each proposal's IPFS payload.
  const usdBudgets = Object.fromEntries(
    await Promise.all(
      passedProjects.map(async (project: any) => {
        try {
          const proposalResponse = await fetch(project.proposalIPFS)
          const proposal = await proposalResponse.json()
          let budget = 0
          if (proposal.budget) {
            proposal.budget.forEach((item: any) => {
              budget +=
                item.token === 'USD' ||
                item.token === 'USDC' ||
                item.token === 'USDT' ||
                item.token === 'DAI'
                  ? Number(item.amount)
                  : 0
            })
          }
          return [project.id, budget]
        } catch (error) {
          console.error(
            `[computeMemberVoteOutcome] Failed to fetch budget for project ${project.id}:`,
            error
          )
          return [project.id, 0]
        }
      })
    )
  )

  const voteOpenTimestamp = Math.floor(
    getThirdThursdayOfQuarterTimestamp(quarter, year).getTime() / 1000
  )
  const voteCloseTimestamp = voteOpenTimestamp + 60 * 60 * 24 * 5

  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)
  if (!vMOONEYs || vMOONEYs.length === 0) return null

  const addressToQuadraticVotingPower: Record<string, number> = Object.fromEntries(
    voteAddresses.map((address, index) => {
      const vMOONEY = vMOONEYs[index] || 0
      const power = isNaN(vMOONEY) ? 0 : Math.sqrt(vMOONEY)
      return [address.toLowerCase(), power]
    })
  )

  // Resolve author addresses so we can strip self-votes from each row.
  const projectIdToAuthorAddress: Record<string, string> = {}
  const AUTHOR_FETCH_BATCH_SIZE = 5
  for (let i = 0; i < passedProjects.length; i += AUTHOR_FETCH_BATCH_SIZE) {
    const batch = passedProjects.slice(i, i + AUTHOR_FETCH_BATCH_SIZE)
    await Promise.all(
      batch.map(async (project: any) => {
        if (!project.proposalIPFS) return
        try {
          const fetchRes = await fetch(project.proposalIPFS)
          if (!fetchRes.ok) return
          const json = await fetchRes.json()
          if (json && typeof json.authorAddress === 'string' && json.authorAddress.length > 0) {
            projectIdToAuthorAddress[String(project.id)] = json.authorAddress
          }
        } catch (error) {
          console.error(
            `[computeMemberVoteOutcome] author fetch failed for project ${project.id}:`,
            error
          )
        }
      })
    )
  }

  type VoteRow = DistributionVote & {
    distribution?: string | Record<string, number>
    quarter?: number
    year?: number
  }
  const votesWithAuthorOwnExcluded: VoteRow[] = votes.map((v) => {
    const row = v as VoteRow
    const voterAddr = row.address?.toLowerCase()
    const raw = row.distribution
    const distribution: Record<string, number> = {}
    let parsedDistribution: Record<string, number> = {}
    if (typeof raw === 'string') {
      try {
        parsedDistribution = JSON.parse(raw)
      } catch {
        parsedDistribution = {}
      }
    } else if (raw && typeof raw === 'object') {
      parsedDistribution = raw as Record<string, number>
    }
    for (const [projectId, value] of Object.entries(parsedDistribution)) {
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && author === voterAddr) continue
      distribution[projectId] = Number(value)
    }
    return { ...row, distribution }
  })

  const [normalizedDistributions] = runIterativeNormalization(
    votesWithAuthorOwnExcluded,
    passedProjects
  )

  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(
    normalizedDistributions,
    addressToQuadraticVotingPower,
    SUM_TO_ONE_HUNDRED
  )
  const totalVotingPower = Object.values(addressToQuadraticVotingPower).reduce(
    (sum, v) => sum + v,
    0
  )
  if (totalVotingPower === 0 || Object.keys(outcome).length === 0) return null

  const projectIdToApproved = getApprovedProjects(
    passedProjects,
    outcome,
    usdBudgets,
    NEXT_QUARTER_BUDGET_USD
  )

  const projectMeta = Object.fromEntries(
    passedProjects.map((p: any) => [String(p.id), p])
  )

  const results: MemberVoteResult[] = Object.entries(outcome)
    .map(([projectId, percentage]) => {
      const project = projectMeta[projectId]
      return {
        projectId,
        percentage: Number(percentage) || 0,
        approved: !!projectIdToApproved[projectId],
        budget: usdBudgets[projectId] || 0,
        MDP: project?.MDP ?? null,
        name: project?.name ?? `Unknown (ID: ${projectId})`,
        rank: 0,
      }
    })
    .sort((a, b) => b.percentage - a.percentage)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return {
    quarter,
    year,
    voteCount: votes.length,
    voterCount: voteAddresses.length,
    voteOpenTimestamp,
    voteCloseTimestamp,
    totalVotingPower,
    quarterBudgetUsd: NEXT_QUARTER_BUDGET_USD,
    results,
    computedAt: Math.floor(Date.now() / 1000),
  }
}
