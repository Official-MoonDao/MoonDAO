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
  MEMBER_VOTE_EXCLUDED_ADDRESSES,
} from 'const/config'
import { readContract, getContract } from 'thirdweb'
import { getThirdThursdayOfQuarterTimestamp } from '@/lib/utils/dates'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import { excludeMemberVotesByAddress } from '@/lib/proposals/excludeMemberVotes'
import { extractUsdBudget } from '@/lib/proposals/extractUsdBudget'
import {
  getMemberVoteVMooneySnapshot,
  resolveSnapshotDistributions,
  resolveSnapshotVMooney,
  snapshotHasDistributions,
} from '@/lib/proposals/vMooneySnapshots'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
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
  /**
   * Optional per-voter / per-project breakdown for the public audit page.
   * Only populated when `computeMemberVoteOutcome` is called with
   * `{ includeAudit: true }`. Heavy enough that the default
   * `MemberVoteResults` panel doesn't need it.
   */
  audit?: MemberVoteAudit
}

export type MemberVoteAudit = {
  voters: Array<{
    address: string
    /** vMOONEY balance at vote close, summed across all chains. */
    vMOONEY: number
    /** Quadratic voting power = √vMOONEY (clamped to 0 on NaN). */
    power: number
    /** What this address actually wrote to the Proposals table. */
    rawDistribution: Record<string, number>
  }>
  /**
   * For each project (keyed by Tableland projectId), the list of every
   * voter's contribution after author self-vote stripping + iterative
   * normalization. `normalizedPct × voter power` reproduces the unscaled
   * outcome; the page renormalizes those across all projects to recover
   * the displayed `percentage` field on `MemberVoteResult`.
   */
  contributions: Record<
    string,
    Array<{
      voterAddress: string
      isAuthor: boolean
      /** Raw allocation before stripping; null if voter didn't allocate. */
      rawPct: number | null
      /** Post-strip + iterative normalization value (sums to 100 per row). */
      normalizedPct: number
    }>
  >
  /** projectId → author address (lowercased). For the per-project header. */
  projectIdToAuthor: Record<string, string>
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
  includeAudit = false,
}: {
  chain: any
  quarter: number
  year: number
  /**
   * When true, return the per-voter / per-project breakdown via
   * `outcome.audit`. Adds no extra fetches — everything's already in
   * memory from the tally — but doubles the response size, so the
   * default lightweight endpoint (`/api/proposals/vote-results`) leaves
   * it off and the audit endpoint opts in.
   */
  includeAudit?: boolean
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

  // Distribution resolution. Past cycles read from the same frozen
  // snapshot in `vMooneySnapshots.ts` that pins voting power, so the
  // audit is fully drift-proof: neither vMOONEY changes nor post-close
  // Tableland edits (the wrapper contract still allows owner-side
  // updates and a row-edit middleware can fail open) can shift the
  // numbers. The active cycle has no snapshot yet, so we still query
  // Tableland live for the in-flight preview.
  const memberSnapshot = getMemberVoteVMooneySnapshot(quarter, year)
  let rawVotes: DistributionVote[]
  if (snapshotHasDistributions(memberSnapshot)) {
    // Snapshot rows use `distribution`; live Tableland rows use `vote`.
    // Downstream VoteRow widens both shapes — cast via unknown is intentional.
    rawVotes = resolveSnapshotDistributions(
      memberSnapshot!
    ) as unknown as DistributionVote[]
  } else {
    const voteStatement = `SELECT * FROM ${proposalsTableName} WHERE quarter = ${quarter} AND year = ${year}`
    rawVotes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  }
  if (!rawVotes || rawVotes.length === 0) return null

  // Mirror of the `vote.ts` POST handler. Same shared helper, same gate
  // — keeps the read-only display in sync with what the on-chain tally
  // will compute, while leaving historical-cycle audits identical to
  // their original outcomes.
  const { votes } = excludeMemberVotesByAddress({
    votes: rawVotes,
    quarter,
    year,
    excludedAddresses: MEMBER_VOTE_EXCLUDED_ADDRESSES,
  })

  if (votes.length === 0) return null
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
  // chain we're tallying), not as the symbol. Build a chain-specific set of
  // stablecoin addresses so the shared extractor (which mirrors the proposal
  // hook's pipeline) recognizes both the legacy symbol form and the address
  // form that the form actually emits today.
  const stablecoinAddressSet = new Set<string>(
    [
      USDC_ADDRESSES?.[chainSlug],
      USDT_ADDRESSES?.[chainSlug],
      DAI_ADDRESSES?.[chainSlug],
    ]
      .filter((a): a is string => typeof a === 'string' && a.length > 0)
      .map((a) => a.toLowerCase())
  )

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
          usdBudgets[projectId] = extractUsdBudget(proposal, {
            stablecoinAddresses: stablecoinAddressSet,
            MDP: project.MDP,
          })
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
  // Voting power resolution. Past cycles read from a frozen snapshot in
  // `vMooneySnapshots.ts` so the audit doesn't drift when voters touch
  // their lock after vote close — see that file's header for the full
  // rationale (`balanceOf(addr, _t)` extrapolates from the LATEST user
  // point, so it's not actually a historical lookup).
  //
  // The active cycle has no snapshot yet — it gets captured by the EB
  // after the on-chain tally fires — so we still need the live RPC path
  // to power the in-flight preview. Once the cycle's snapshot lands in
  // the constants file and ships, the audit for that quarter freezes.
  //
  // The default `voteCloseTimestamp` formula (third Thursday + 5 days)
  // matches the on-chain `vote.ts` close calculation, but the *actual*
  // governance close moment can diverge — e.g. Q2 2026 is pinned by the
  // snapshot to 2026-04-20 00:00 UTC, not the formula's 2026-04-21
  // (the formula treats the submission deadline as the vote-open, but
  // voting actually starts after the Senate phase). When a snapshot is
  // present and pins its own `voteCloseTimestamp`, we use THAT for the
  // displayed close date so the audit page is internally consistent
  // (values come from the snapshot, displayed close date matches when
  // those values were captured).
  // Reuse the snapshot already fetched at the top of the function for
  // the distribution lookup. Lookup is a constant-time map read so a
  // second call would also be cheap, but reusing the binding makes the
  // dependency between the two reads explicit.
  const snapshot = memberSnapshot
  const voteCloseTimestamp =
    snapshot?.voteCloseTimestamp ?? voteOpenTimestamp + 60 * 60 * 24 * 5
  const vMOONEYs = snapshot
    ? resolveSnapshotVMooney(snapshot, voteAddresses)
    : await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)
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
  // Keep the raw (pre-strip) distribution per voter so the audit page can
  // surface the difference between what someone wrote vs. what got counted
  // after author self-vote stripping. Map key is lowercased address.
  const addressToRawDistribution: Record<string, Record<string, number>> = {}
  const votesWithAuthorOwnExcluded: VoteRow[] = votes.map((v) => {
    const row = v as VoteRow
    const voterAddr = row.address?.toLowerCase()
    const raw = row.distribution
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
    if (voterAddr) {
      const cleanRaw: Record<string, number> = {}
      for (const [pid, value] of Object.entries(parsedDistribution)) {
        const n = Number(value)
        if (Number.isFinite(n) && n >= 0) cleanRaw[pid] = n
      }
      addressToRawDistribution[voterAddr] = cleanRaw
    }
    // Build the post-strip distribution that gets fed into the iterative
    // normalizer. Two distinct cases for "missing" cells:
    //   - Voter is the AUTHOR of the project: omit the key entirely so
    //     `runIterativeNormalization` sees NaN and fills it with the column
    //     average of the OTHER voters. Authors can't self-vote, so this
    //     gives them the crowd's view of their own project as a stand-in.
    //   - Voter is NOT the author and just didn't allocate: write an
    //     explicit 0. Silence is NOT consent — we shouldn't synthesize
    //     support for a project the voter didn't endorse, which is what
    //     blanket column-average imputation would do.
    // This is what makes "Raw % == Normalized %" hold for non-author voters
    // whose explicit allocations already sum to 100; only the row-rescale
    // changes things, never imputation.
    const distribution: Record<string, number> = {}
    for (const project of passedProjects) {
      const projectId = String(project.id)
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && voterAddr && author === voterAddr) continue
      const rawVal = parsedDistribution[projectId]
      const numericValue = Number(rawVal)
      if (rawVal != null && Number.isFinite(numericValue) && numericValue >= 0) {
        distribution[projectId] = numericValue
      } else {
        distribution[projectId] = 0
      }
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

  let audit: MemberVoteAudit | undefined
  if (includeAudit) {
    const lowerAddrToVMOONEY: Record<string, number> = Object.fromEntries(
      voteAddresses.map((address, index) => [
        address.toLowerCase(),
        Number(vMOONEYs[index]) || 0,
      ])
    )
    const voters = voteAddresses
      .map((address) => {
        const lower = address.toLowerCase()
        return {
          address: lower,
          vMOONEY: lowerAddrToVMOONEY[lower] || 0,
          power: addressToQuadraticVotingPower[lower] || 0,
          rawDistribution: addressToRawDistribution[lower] || {},
        }
      })
      .sort((a, b) => b.power - a.power)

    const projectIdToAuthorLower: Record<string, string> = Object.fromEntries(
      Object.entries(projectIdToAuthorAddress).map(([pid, addr]) => [
        pid,
        (addr || '').toLowerCase(),
      ])
    )

    // Build an address → normalized distribution map from the iterative
    // normalization output. `runIterativeNormalization` returns rows shaped
    // like the input (`{ address, distribution }`) with stripped projects
    // dropped, so this mirrors what `runQuadraticVoting` actually consumed.
    const lowerAddrToNormalized: Record<string, Record<string, number>> = {}
    for (const d of normalizedDistributions as any[]) {
      const lower = (d?.address || '').toLowerCase()
      if (!lower) continue
      lowerAddrToNormalized[lower] = (d?.distribution || {}) as Record<
        string,
        number
      >
    }

    const contributions: MemberVoteAudit['contributions'] = {}
    for (const project of passedProjects) {
      const projectId = String(project.id)
      const authorLower = projectIdToAuthorLower[projectId] || ''
      const rows: MemberVoteAudit['contributions'][string] = []
      for (const voter of voters) {
        const rawVal = voter.rawDistribution[projectId]
        const normalizedVal =
          lowerAddrToNormalized[voter.address]?.[projectId] || 0
        // Only surface voters who either allocated to this project (raw or
        // normalized) — keeps each project row focused on its actual
        // supporters instead of every voter showing 0%.
        if (
          (rawVal == null || rawVal === 0) &&
          (!Number.isFinite(normalizedVal) || normalizedVal === 0)
        ) {
          continue
        }
        rows.push({
          voterAddress: voter.address,
          isAuthor: authorLower !== '' && authorLower === voter.address,
          rawPct: typeof rawVal === 'number' ? rawVal : null,
          normalizedPct: Number.isFinite(normalizedVal) ? normalizedVal : 0,
        })
      }
      // Highest weighted contribution first so the page can spotlight the
      // top supporters without re-sorting client-side.
      rows.sort((a, b) => {
        const aPower = addressToQuadraticVotingPower[a.voterAddress] || 0
        const bPower = addressToQuadraticVotingPower[b.voterAddress] || 0
        return b.normalizedPct * bPower - a.normalizedPct * aPower
      })
      contributions[projectId] = rows
    }

    audit = {
      voters,
      contributions,
      projectIdToAuthor: projectIdToAuthorLower,
    }
  }

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
    ...(audit ? { audit } : {}),
  }
}
