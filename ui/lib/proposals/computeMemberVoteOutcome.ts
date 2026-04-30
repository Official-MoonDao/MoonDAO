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
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  DAI_ADDRESSES,
} from 'const/config'
import { readContract, getContract } from 'thirdweb'
import { getThirdThursdayOfQuarterTimestamp } from '@/lib/utils/dates'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
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

  // Each proposal's IPFS payload is the source of truth for both the USD
  // budget (used by the budget-cap inside `getApprovedProjects`) and the
  // author address (used to strip self-votes). Fetch the payload once per
  // project, derive both in the same pass, and batch in small groups so
  // we don't fan a hundred-plus concurrent requests at the IPFS gateway —
  // bursts there used to rate-limit us and surface as zeroed-out budgets
  // / unstripped self-votes.
  const BATCH_SIZE = 5
  const usdBudgets: Record<string, number> = {}
  const projectIdToAuthorAddress: Record<string, string> = {}
  // Cache the bits of each IPFS payload that `getProjectDisplayName` needs so
  // the UI can resolve "MDP-X: <real title>" instead of falling back to the
  // Tableland `name` column, which is sometimes literally "Untitled" for rows
  // that were created before the proposal title was finalized.
  const projectIdToProposalTitleParts: Record<
    string,
    { title?: string; body?: string }
  > = {}

  // The proposal editor's `SafeTokenForm` writes the budget item's `token`
  // field as the *contract address* of the selected token (USDC/DAI on the
  // chain we're tallying), not as the symbol. So a strict symbol match like
  // `item.token === 'USDC'` misses essentially every modern proposal and
  // shows $0 in the Member Vote Results panel. Build a chain-specific set of
  // known stablecoin addresses (lowercased) so we recognize both the legacy
  // symbol form ('USD'/'USDC'/'USDT'/'DAI', any case) and the address form
  // that the form actually emits today.
  const stablecoinAddressSet = new Set<string>(
    [
      USDC_ADDRESSES?.[chainSlug],
      USDT_ADDRESSES?.[chainSlug],
      DAI_ADDRESSES?.[chainSlug],
    ]
      .filter((a): a is string => typeof a === 'string' && a.length > 0)
      .map((a) => a.toLowerCase())
  )
  const stablecoinSymbolSet = new Set(['usd', 'usdc', 'usdt', 'dai'])

  function isUsdLikeToken(token: unknown): boolean {
    if (typeof token !== 'string') return false
    const trimmed = token.trim()
    if (!trimmed) return false
    if (trimmed.startsWith('0x')) {
      return stablecoinAddressSet.has(trimmed.toLowerCase())
    }
    return stablecoinSymbolSet.has(trimmed.toLowerCase())
  }

  function extractUsdBudget(proposal: any): number {
    let budget = 0
    if (proposal?.budget && Array.isArray(proposal.budget)) {
      for (const item of proposal.budget) {
        if (!isUsdLikeToken(item?.token)) continue
        const amount = Number(item?.amount)
        if (Number.isFinite(amount) && amount > 0) budget += amount
      }
    }
    return budget
  }

  for (let i = 0; i < passedProjects.length; i += BATCH_SIZE) {
    const batch = passedProjects.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (project: any) => {
        const projectId = String(project.id)
        // Default the budget to 0 so a missing IPFS payload doesn't drop
        // the project out of `getApprovedProjects`'s budget-cap loop —
        // it'll just count as $0 toward the cap (same behavior as before).
        usdBudgets[projectId] = 0
        if (!project.proposalIPFS) return
        try {
          const proposalResponse = await fetch(project.proposalIPFS)
          if (!proposalResponse.ok) return
          const proposal = await proposalResponse.json()
          usdBudgets[projectId] = extractUsdBudget(proposal)
          if (
            proposal &&
            typeof proposal.authorAddress === 'string' &&
            proposal.authorAddress.length > 0
          ) {
            projectIdToAuthorAddress[projectId] = proposal.authorAddress
          }
          projectIdToProposalTitleParts[projectId] = {
            title: typeof proposal?.title === 'string' ? proposal.title : undefined,
            body: typeof proposal?.body === 'string' ? proposal.body : undefined,
          }
        } catch (error) {
          console.error(
            `[computeMemberVoteOutcome] proposal IPFS fetch failed for project ${project.id}:`,
            error
          )
        }
      })
    )
  }

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
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue) || numericValue < 0) continue
      distribution[projectId] = numericValue
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
      const titleParts = projectIdToProposalTitleParts[projectId]
      // Use the same resolution as `ProposalInfo`: prefer a real Tableland
      // `name`, then the IPFS title, then the first meaningful body line, and
      // only fall back to "Untitled Project" when nothing usable exists.
      const displayName = project
        ? getProjectDisplayName(project, titleParts)
        : `Unknown (ID: ${projectId})`
      return {
        projectId,
        percentage: Number(percentage) || 0,
        approved: !!projectIdToApproved[projectId],
        budget: usdBudgets[projectId] || 0,
        MDP: project?.MDP ?? null,
        name: displayName,
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
