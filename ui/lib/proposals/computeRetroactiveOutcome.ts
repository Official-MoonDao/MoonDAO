/**
 * Read-only counterpart to the retroactive-rewards tally that lives
 * client-side in `components/nance/ProjectRewards.tsx`.
 *
 * Replays the same `computeRewardPercentages` pipeline used by the
 * Retroactive Rewards tab so the outcome can be displayed on `/projects`
 * (and previewed by anyone before the cycle closes) WITHOUT touching
 * the chain. Mirrors the structure of `computeMemberVoteOutcome.ts`:
 *
 *   - Pulls eligible projects + retro distributions from Tableland.
 *   - Splits voters into citizens / non-citizens via the Citizen NFT
 *     contract (same `getOwnedToken` probe `useCitizens` uses).
 *   - Snapshots √vMOONEY across all chains at the rewards-cycle close.
 *   - Feeds the result into the shared `computeRewardPercentages`
 *     pipeline (fill-in-zeros → zero-out-contributors → iterative
 *     normalization → best-fit projection for non-citizens →
 *     quadratic voting).
 *   - Annotates each project with its ETH and MOONEY share for the
 *     configured pool.
 *
 * Differences vs. the client tally in `ProjectRewards.tsx`:
 *   - No on-chain transaction or CSV generation; this is purely a
 *     read-only computation for the audit/preview UI.
 *   - The contributor-payout logic in `getPayouts` (per-address
 *     splits, MOONEY/USD upfront overlays) is intentionally skipped
 *     because projects are now funded directly — the audit only
 *     surfaces the per-project pool share, not per-contributor wires.
 *
 * Keep this in sync with `computeRewardPercentages` / `getPayouts` /
 * the retro pool config in `ProjectRewards.tsx` if the math changes.
 */
import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_ADDRESSES,
  DISTRIBUTION_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  RETRO_ETH_BUDGET,
  RETRO_PAYOUT_TOKEN,
  RETRO_PRIMARY_COMMUNITY_CIRCLE,
  RETRO_USD_BUDGET,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import {
  getRetroVMooneySnapshot,
  resolveSnapshotDistributions,
  resolveSnapshotVMooney,
  snapshotHasDistributions,
} from '@/lib/proposals/vMooneySnapshots'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import {
  computeRewardPercentages,
  normalizeJsonString,
} from '@/lib/utils/rewards'

// MOONEY budget per quarter: identical to `getBudget()` in
// `lib/utils/rewards.ts` so the audit pool matches what the live UI
// shows. Kept here so this file doesn't need to assemble the full
// treasury-tokens array (which is browser-only via `useAssets`).
const MOONEY_INITIAL_BUDGET = 15_000_000
const MOONEY_DECAY_RATE = 0.95

function getMooneyBudgetForCycle(year: number, quarter: number): number {
  const numQuartersPastQ4Y2022 = (year - 2023) * 4 + quarter
  return MOONEY_INITIAL_BUDGET * MOONEY_DECAY_RATE ** numQuartersPastQ4Y2022
}

// Standard 90/10 split between project rewards and the community circle,
// expressed as a fraction of the original quarterly budget (before any
// upfront project funding). Used to derive the live cycle's defaults
// when a (quarter, year) hasn't been frozen into `HISTORICAL_RETRO_POOLS`
// yet. The community circle reservation is taken off the original
// quarterly budget — NOT the post-upfront retro remainder — so it does
// NOT scale down when projects get funded upfront.
const COMMUNITY_CIRCLE_FRACTION = 0.1
const PROJECT_REWARDS_FRACTION = 0.9

type FrozenRetroPool = {
  primaryAsset: 'ETH' | 'USDC'
  /** ETH/USDC distributed to projects via the retro vote (post-upfront remainder). */
  primaryProjectsAmount: number
  /** MOONEY distributed to projects via the retro vote. */
  mooneyProjectsAmount: number
  /** Community circle's slice of the primary asset for the cycle. */
  communityCirclePrimary: number
  /** Community circle's slice of MOONEY for the cycle. */
  communityCircleMooney: number
}

// Frozen per-cycle retro pool snapshots. We can't infer historical
// pools from `RETRO_PAYOUT_TOKEN` / `RETRO_*_BUDGET` because those
// constants only ever describe the *current* cycle — once the EB rolls
// the config forward they no longer reflect what the prior cycle
// actually paid out. Each completed cycle gets pinned here so audits
// of past quarters render their real pool. New cycles fall through
// to the live config values; when a cycle closes, copy its config
// snapshot into a new entry below — including the community circle
// amounts so the audit page can show every cent the cycle paid out.
const HISTORICAL_RETRO_POOLS: Record<string, FrozenRetroPool> = {
  // Q1 2026 retroactives (paid in ETH, voting closed Apr 21, 2026).
  // Quarterly total: 11.6 ETH + 7,700,000 MOONEY.
  //   - 90% projects (10.44 ETH / 6,930,000 MOONEY).
  //     8.225 ETH was paid upfront to funded projects, leaving
  //     2.215 ETH for retro distribution. MOONEY had no upfront
  //     payouts so the full 6,930,000 went to retro.
  //   - 10% community circle (1.16 ETH / 770,000 MOONEY).
  '2026-Q1': {
    primaryAsset: 'ETH',
    primaryProjectsAmount: 2.215,
    mooneyProjectsAmount: 6_930_000,
    communityCirclePrimary: 1.16,
    communityCircleMooney: 770_000,
  },
}

/**
 * Mirror of `isRewardsCycle` (lib/utils/dates.ts) cycle-close semantics:
 * the rewards window for a (quarter, year) cycle ends on the first
 * Tuesday strictly after the date 14 days into the *following* quarter.
 * The "strictly after" comes from `daysUntilDay`'s
 * `daysUntil === 0 ? 7 : daysUntil` rule — if day-14 itself lands on a
 * Tuesday, the close jumps to the following Tuesday, exactly like the
 * on-chain tally does. Using that close as the vMOONEY snapshot means
 * the audit reproduces the same power values the on-chain tally used.
 */
function getRetroVoteCloseTimestamp(quarter: number, year: number): number {
  const nextQuarterIndex = quarter % 4 // 0..3
  const nextQuarterYear = quarter === 4 ? year + 1 : year
  const nextQuarterStart = new Date(Date.UTC(nextQuarterYear, nextQuarterIndex * 3, 1))
  const fourteenIn = new Date(nextQuarterStart)
  fourteenIn.setUTCDate(fourteenIn.getUTCDate() + 14)
  const TUESDAY = 2
  const dow = fourteenIn.getUTCDay()
  // `|| 7` mirrors `daysUntilDay`'s `daysUntil === 0 ? 7 : daysUntil`:
  // when day-14 itself is a Tuesday, advance to the next Tuesday so the
  // snapshot timestamp matches `isRewardsCycle`'s window edge.
  const daysUntilTuesday = ((TUESDAY - dow + 7) % 7) || 7
  const close = new Date(fourteenIn)
  close.setUTCDate(close.getUTCDate() + daysUntilTuesday)
  return Math.floor(close.getTime() / 1000)
}

// Sequential read with retry so a transient RPC blip on the citizen
// probe doesn't flip a real citizen into "non-citizen" (which would
// silently move them into the best-fit cohort and skew the tally).
async function readContractWithRetry<T>(
  contract: any,
  method: string,
  params: any[],
  maxRetries = 3,
  baseDelayMs = 400
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await readContract({ contract, method, params })
      return result as T
    } catch (error) {
      lastError = error
      const isRetryable =
        error instanceof TypeError &&
        String(error.message).includes('buffer')
      if (!isRetryable || attempt === maxRetries - 1) throw error
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

// Same hard-coded "citizen-equivalent voting addresses" allowlist as
// `ProjectRewards.tsx` — payout addresses for citizens whose primary
// wallet differs from the one they vote with. Kept in sync by hand;
// adding a new entry here AND in the component is a small ask given
// how rarely the list changes.
const CITIZEN_VOTING_ADDRESSES = new Set<string>([
  '0x78176eaabcb3255e898079dc67428e15149cdc99',
  '0x9fdf876a50ea8f95017dcfc7709356887025b5bb',
])

export type RetroactiveResult = {
  rank: number
  projectId: string
  MDP: number | string | null
  name: string
  /**
   * Project's share of the retro project pool, expressed as a percentage.
   * Sums to 100 across all results in the cycle (modulo float drift).
   * The community-circle slice is tracked separately on `outcome.pool`
   * — it's a parallel cohort, NOT a slice of this same pool — so this
   * percentage is renormalized over eligible projects only after the
   * shared `runQuadraticVoting` carve-out is filtered out.
   */
  percentage: number
  /** Project's slice of the retro primary-asset pool (ETH or USDC, depending on `pool.primaryAsset`). */
  primaryShare: number
  /** Project's slice of the retro MOONEY pool. */
  mooneyShare: number
}

export type RetroactiveAudit = {
  voters: Array<{
    address: string
    isCitizen: boolean
    /** vMOONEY balance at vote close, summed across all chains. */
    vMOONEY: number
    /** Quadratic voting power = √vMOONEY (clamped to 0 on NaN). */
    power: number
    /** Raw allocation as written to the Distribution table, before any normalization. */
    rawDistribution: Record<string, number>
  }>
  /**
   * Per-project supporter list. For citizen voters this surfaces the
   * post-zero-out + iterative-normalization weight that actually fed
   * the quadratic tally. Non-citizen voters are NOT included here:
   * their contribution is projected through `getBestFitDistributions`
   * (an L1-minimization onto the citizen-vote basis), which produces
   * coefficients over citizens rather than per-project weights — there's
   * no honest per-project number to show. They still appear in `voters`
   * with their raw distribution so auditors can see what they wrote.
   */
  contributions: Record<
    string,
    Array<{
      voterAddress: string
      isContributor: boolean
      /** Raw allocation before zero-out / normalization. null if voter didn't allocate. */
      rawPct: number | null
      /** Post-zero-out + iterative-normalization value (sums to 100 per row across non-contributor cells). */
      normalizedPct: number
    }>
  >
  /** projectId → lowercased contributor address set, for the per-project header. */
  projectIdToContributors: Record<string, string[]>
}

export type RetroactiveOutcome = {
  quarter: number
  year: number
  voteCount: number
  voterCount: number
  citizenVoterCount: number
  voteCloseTimestamp: number
  totalCitizenPower: number
  totalPower: number
  pool: {
    primaryAsset: 'ETH' | 'USDC'
    /** ETH/USDC distributed to projects via the retro vote (post-upfront). */
    primaryAmount: number
    /** MOONEY distributed to projects via the retro vote. */
    mooneyAmount: number
    /**
     * Community circle's slice of the primary asset for this cycle.
     * Tracked alongside the project pool so audits can show every cent
     * the cycle paid out. The community circle is a parallel cohort
     * (10% of the original quarterly budget, set aside before upfront
     * project funding) — it's NOT carved out of `primaryAmount`, so
     * the two values do NOT sum to a fixed total once upfront payouts
     * have shifted the project pool.
     */
    communityCirclePrimary: number
    /** Community circle's slice of the MOONEY pool for this cycle. */
    communityCircleMooney: number
  }
  results: RetroactiveResult[]
  computedAt: number
  /**
   * Optional per-voter / per-project breakdown for the public audit
   * page. Only populated when `computeRetroactiveOutcome` is called
   * with `{ includeAudit: true }`. Same trade-off as the member-vote
   * audit — heavy enough that the lightweight panel endpoint leaves
   * it off and the audit endpoint opts in.
   */
  audit?: RetroactiveAudit
}

export async function computeRetroactiveOutcome({
  chain,
  quarter,
  year,
  includeAudit = false,
}: {
  chain: any
  quarter: number
  year: number
  includeAudit?: boolean
}): Promise<RetroactiveOutcome | null> {
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
  const projectTableName = PROJECT_TABLE_NAMES[chainSlug]
  const distributionTableName = DISTRIBUTION_TABLE_NAMES[chainSlug]
  const citizenAddress = CITIZEN_ADDRESSES[chainSlug]
  if (!projectTableName || !distributionTableName || !citizenAddress) {
    return null
  }

  // The (quarter, year) parameter is the *voting cycle* (when distributions
  // were submitted) — NOT the cohort's project quarter. The eligible projects
  // voted on usually belong to a prior cycle (e.g. Q1 2026 voting tallies
  // Q4 2025 projects), and the project table's `eligible` column is mutable
  // state that gets reused across cycles, so neither the voting (quarter,
  // year) nor the current `eligible` flag is reliable for picking the
  // tally cohort. Instead, derive the cohort from the project ids actually
  // referenced in this cycle's distribution rows — those are the projects
  // that were eligible at vote time, and the set is immutable after the
  // fact (distributions can be edited but only across the same project
  // surface a voter saw).
  // Distribution resolution. Past cycles read from the same frozen
  // snapshot in `vMooneySnapshots.ts` that pins voting power, so the
  // audit is fully drift-proof. Active cycle (no snapshot yet) still
  // queries Tableland live for the in-flight preview.
  const retroSnapshot = getRetroVMooneySnapshot(quarter, year)
  let rawDistributions: any[]
  if (snapshotHasDistributions(retroSnapshot)) {
    rawDistributions = resolveSnapshotDistributions(retroSnapshot!)
  } else {
    const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE quarter = ${quarter} AND year = ${year}`
    rawDistributions = (await queryTable(chain, distributionStatement)) || []
  }
  if (rawDistributions.length === 0) return null

  const referencedProjectIds = new Set<string>()
  for (const d of rawDistributions) {
    const parsed = normalizeJsonString(d?.distribution) as Record<string, unknown>
    for (const pid of Object.keys(parsed || {})) referencedProjectIds.add(String(pid))
  }
  if (referencedProjectIds.size === 0) return null

  const idList = [...referencedProjectIds]
    .filter((pid) => /^\d+$/.test(pid))
    .map((pid) => Number(pid))
  if (idList.length === 0) return null

  const projectStatement = `SELECT * FROM ${projectTableName} WHERE id IN (${idList.join(',')})`
  const eligibleProjects = (await queryTable(chain, projectStatement)) || []
  if (eligibleProjects.length === 0) return null

  // Normalize the on-chain distribution column (sometimes object,
  // sometimes JSON string) to an object up front so downstream callers
  // (`computeRewardPercentages`, the audit collector below) don't each
  // need to redo the same parse.
  type NormalizedDistRow = {
    id?: number | string
    address: string
    year: number
    quarter: number
    distribution: Record<string, number>
  }
  const distributions: NormalizedDistRow[] = rawDistributions
    .map((d: any) => {
      const address = typeof d?.address === 'string' ? d.address : ''
      if (!address) return null
      const parsed = normalizeJsonString(d.distribution)
      const cleaned: Record<string, number> = {}
      for (const [pid, value] of Object.entries(parsed || {})) {
        const n = Number(value)
        if (Number.isFinite(n) && n >= 0 && n <= 100) cleaned[pid] = n
      }
      return {
        id: d?.id,
        address,
        year: Number(d?.year) || year,
        quarter: Number(d?.quarter) || quarter,
        distribution: cleaned,
      } as NormalizedDistRow
    })
    .filter((d: NormalizedDistRow | null): d is NormalizedDistRow => !!d)

  if (distributions.length === 0) return null

  const voteAddresses = distributions.map((d) => d.address)

  // Citizen membership at compute-time. We probe `getOwnedToken` on the
  // Citizen NFT contract for each voter — same exact check `useCitizens`
  // does in the browser — and merge in the hard-coded payout-address
  // allowlist so designated citizen-equivalent wallets still count as
  // citizens for the tally. A revert means "no token owned" → not a
  // citizen; any other unexpected error is logged and the voter falls
  // back to non-citizen so they go through the best-fit path rather
  // than getting their distribution counted as a citizen on a transient
  // RPC error.
  const citizenContract = getContract({
    client: serverClient,
    address: citizenAddress,
    abi: CitizenABI as any,
    chain,
  })
  const isCitizenByAddress: Record<string, boolean> = {}
  for (const address of voteAddresses) {
    const lower = address.toLowerCase()
    if (CITIZEN_VOTING_ADDRESSES.has(lower)) {
      isCitizenByAddress[lower] = true
      continue
    }
    try {
      const ownedTokenId = await readContractWithRetry<any>(
        citizenContract,
        'getOwnedToken',
        [address]
      )
      isCitizenByAddress[lower] = !!ownedTokenId
    } catch (error: any) {
      // `getOwnedToken` reverts with "No token owned" for non-citizens;
      // surface only unexpected failures so they don't silently count
      // as anything other than non-citizen.
      const reason: string | undefined = error?.reason || error?.shortMessage
      if (typeof reason === 'string' && /no token owned/i.test(reason)) {
        isCitizenByAddress[lower] = false
      } else {
        console.warn(
          `[computeRetroactiveOutcome] citizen probe failed for ${address}; treating as non-citizen.`,
          error
        )
        isCitizenByAddress[lower] = false
      }
    }
  }

  // vMOONEY snapshot at vote close. Past cycles read from a frozen
  // snapshot in `vMooneySnapshots.ts` so the audit doesn't drift when
  // voters touch their lock after vote close — the on-chain
  // `balanceOf(addr, _t)` extrapolates from the LATEST user point, not a
  // truly historical one, so re-querying it post-cycle silently moves
  // the numbers around (see `vMooneySnapshots.ts` header).
  //
  // The active cycle has no snapshot yet, so we still call the live
  // multi-chain `√vMOONEY` fetcher to drive the in-flight preview.
  // Failures return 0s (matching the production hook's behavior).
  //
  // Snapshots also carry the authoritative `voteCloseTimestamp` for
  // the cycle they describe — the formula here is a default for the
  // in-flight preview but can diverge from the actual governance close
  // moment. Prefer the snapshot's value so the audit page's displayed
  // close date matches when the pinned values were captured.
  // Reuse the snapshot binding from the distribution lookup above.
  const snapshot = retroSnapshot
  const voteCloseTimestamp =
    snapshot?.voteCloseTimestamp ?? getRetroVoteCloseTimestamp(quarter, year)
  const vMOONEYs = snapshot
    ? resolveSnapshotVMooney(snapshot, voteAddresses)
    : await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)
  if (!vMOONEYs || vMOONEYs.length === 0) return null

  const addressToVMOONEY: Record<string, number> = {}
  const addressToQuadraticVotingPower: Record<string, number> = {}
  for (let i = 0; i < voteAddresses.length; i++) {
    const lower = voteAddresses[i].toLowerCase()
    const v = Number(vMOONEYs[i]) || 0
    addressToVMOONEY[lower] = v
    addressToQuadraticVotingPower[lower] = isNaN(v) ? 0 : Math.sqrt(v)
  }

  // Split votes by citizen status. The shared compute fn expects the
  // two cohorts separately and runs different pipelines on each.
  const citizenDistributions = distributions.filter(
    (d) => isCitizenByAddress[d.address.toLowerCase()]
  )
  const nonCitizenDistributions = distributions.filter(
    (d) => !isCitizenByAddress[d.address.toLowerCase()]
  )

  // The shared `computeRewardPercentages` keys voting power by the
  // *original* address (not lowercased). Build a parallel map so the
  // citizen / non-citizen rows downstream find the right power.
  const addressToPowerOriginalCase: Record<string, number> = {}
  for (const d of distributions) {
    addressToPowerOriginalCase[d.address] =
      addressToQuadraticVotingPower[d.address.toLowerCase()] || 0
  }

  const projectIdToEstimatedPercentage = computeRewardPercentages(
    citizenDistributions,
    nonCitizenDistributions,
    eligibleProjects,
    addressToPowerOriginalCase
  )

  // Drop bogus keys produced by the non-citizen best-fit path AND
  // renormalize across eligible projects so the resulting percentages
  // describe each project's share of the *retro project pool* (which
  // is what `pool.primaryAmount` / `pool.mooneyAmount` represent).
  //
  // Why renormalize? `runQuadraticVoting` reserves a 10% slice for
  // the community circle by normalizing its output to sum to 90
  // across every key it sees — including integer-indexed keys that
  // come out of the non-citizen best-fit projection (the helper
  // returns an array, and `Object.entries` exposes it under '0',
  // '1', '2', …). Those bogus keys aren't projects, and the community
  // circle is now tracked as its own pool on `outcome.pool` (see
  // `HISTORICAL_RETRO_POOLS`), so neither belongs in the per-project
  // percentage. Filtering to `eligibleIdSet` and rescaling to sum to
  // 100 gives a clean "% of project pool" that matches the displayed
  // ETH/MOONEY shares (which are computed as `pct * primaryAmount`
  // and `pct * mooneyAmount`).
  const eligibleIdSet = new Set(eligibleProjects.map((p: any) => String(p.id)))
  const filteredOutcome: Record<string, number> = {}
  for (const [pid, pct] of Object.entries(projectIdToEstimatedPercentage)) {
    if (eligibleIdSet.has(String(pid))) filteredOutcome[String(pid)] = pct
  }
  const filteredSum = Object.values(filteredOutcome).reduce((s, v) => s + v, 0)
  const cleanedOutcome: Record<string, number> = {}
  for (const [pid, pct] of Object.entries(filteredOutcome)) {
    cleanedOutcome[pid] = filteredSum > 0 ? (pct / filteredSum) * 100 : 0
  }

  const totalCitizenPower = citizenDistributions.reduce(
    (sum, d) => sum + (addressToQuadraticVotingPower[d.address.toLowerCase()] || 0),
    0
  )
  const totalPower = Object.values(addressToQuadraticVotingPower).reduce(
    (sum, v) => sum + v,
    0
  )

  // Pool sizes per voting cycle. Each completed cycle gets a frozen
  // entry in `HISTORICAL_RETRO_POOLS` so audits of past quarters render
  // their actual pool (project + community circle, in both the primary
  // asset and MOONEY) rather than the live config values. The current
  // cycle falls through to `RETRO_PAYOUT_TOKEN` / `RETRO_*_BUDGET` /
  // `RETRO_PRIMARY_COMMUNITY_CIRCLE`, which is what `ProjectRewards.tsx`
  // reads when showing the live retro tab. When a cycle closes and
  // config rolls forward to the next cycle, copy the now-historical
  // values (including the community circle) into a new entry above.
  const cycleKey = `${year}-Q${quarter}`
  const historicalPool = HISTORICAL_RETRO_POOLS[cycleKey]
  const isEthPayoutCycle = historicalPool
    ? historicalPool.primaryAsset === 'ETH'
    : RETRO_PAYOUT_TOKEN === 'ETH'
  // For the live cycle, MOONEY has no upfront carve-out (we only spend
  // MOONEY via retro), so projects get the full 90% slice of the
  // quarterly MOONEY budget and the community circle gets 10%.
  const liveMooneyTotal = getMooneyBudgetForCycle(year, quarter)
  const primaryAmount = historicalPool
    ? historicalPool.primaryProjectsAmount
    : isEthPayoutCycle
    ? RETRO_ETH_BUDGET
    : RETRO_USD_BUDGET
  const mooneyAmount = historicalPool
    ? historicalPool.mooneyProjectsAmount
    : liveMooneyTotal * PROJECT_REWARDS_FRACTION
  const communityCirclePrimary = historicalPool
    ? historicalPool.communityCirclePrimary
    : RETRO_PRIMARY_COMMUNITY_CIRCLE
  const communityCircleMooney = historicalPool
    ? historicalPool.communityCircleMooney
    : liveMooneyTotal * COMMUNITY_CIRCLE_FRACTION

  const projectMeta = Object.fromEntries(
    eligibleProjects.map((p: any) => [String(p.id), p])
  )

  const unrankedResults: RetroactiveResult[] = eligibleProjects.map(
    (project: any): RetroactiveResult => {
      const projectId = String(project.id)
      const percentage = Number(cleanedOutcome[projectId] || 0)
      const displayName = getProjectDisplayName(projectMeta[projectId])
      return {
        projectId,
        percentage,
        primaryShare: (percentage / 100) * primaryAmount,
        mooneyShare: (percentage / 100) * mooneyAmount,
        MDP: project?.MDP ?? null,
        name: displayName,
        rank: 0,
      }
    }
  )
  const results: RetroactiveResult[] = unrankedResults
    .sort((a, b) => b.percentage - a.percentage)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  let audit: RetroactiveAudit | undefined
  if (includeAudit) {
    // Build a citizen-only normalized matrix the same way
    // `computeRewardPercentages` does internally so per-project
    // contributions reflect what the quadratic tally actually saw.
    // Inlined here (rather than threaded through the shared helper)
    // because the shared helper returns only the final per-project
    // percentages — not the intermediate per-voter weights.
    const {
      runIterativeNormalization,
    } = await import('@/lib/utils/rewards')

    const fillInZeros = (rows: NormalizedDistRow[]) =>
      rows.map((d) => {
        const newDist: Record<string, number> = {}
        for (const project of eligibleProjects) {
          const pid = String(project.id)
          newDist[pid] = pid in d.distribution ? d.distribution[pid] : 0
        }
        return { ...d, distribution: newDist }
      })

    const projectIdToContributors: Record<string, string[]> = {}
    for (const project of eligibleProjects) {
      const pid = String(project.id)
      const contributors = normalizeJsonString(project.rewardDistribution) as Record<
        string,
        number
      >
      projectIdToContributors[pid] = Object.keys(contributors || {}).map((a) =>
        a.toLowerCase()
      )
    }

    // Mirror `zeroOutDistributionForContributors`: contributors get NaN
    // on their own project (filled with column average by iterative
    // normalization), then each row is rescaled so the surviving cells
    // sum to 100. Doing this inline (instead of importing the private
    // helper from `rewards.ts`) keeps the audit shape decoupled from
    // the unexported pipeline internals.
    const filledCitizen = fillInZeros(citizenDistributions)
    const zeroedForContributors = filledCitizen.map((d) => {
      const lower = d.address.toLowerCase()
      const newDist: Record<string, number> = {}
      for (const [pid, value] of Object.entries(d.distribution)) {
        const contributors = projectIdToContributors[pid] || []
        if (contributors.includes(lower)) {
          newDist[pid] = NaN
        } else {
          newDist[pid] = value
        }
      }
      // Renormalize across surviving cells to sum to 100, matching
      // the helper's behavior so iterative normalization receives a
      // pre-normalized row.
      const rowSum = Object.values(newDist)
        .filter((n) => Number.isFinite(n))
        .reduce((s, n) => s + n, 0)
      const normRow: Record<string, number> = {}
      for (const [pid, val] of Object.entries(newDist)) {
        if (!Number.isFinite(val)) continue
        normRow[pid] = rowSum > 0 ? (val / rowSum) * 100 : 0
      }
      return { ...d, distribution: normRow }
    })

    const [normalizedCitizenRows] = runIterativeNormalization(
      zeroedForContributors,
      eligibleProjects
    )

    const lowerToNormalized: Record<string, Record<string, number>> = {}
    for (const row of normalizedCitizenRows as any[]) {
      const lower = (row?.address || '').toLowerCase()
      if (!lower) continue
      lowerToNormalized[lower] = (row?.distribution || {}) as Record<string, number>
    }

    const voters = distributions
      .map((d) => {
        const lower = d.address.toLowerCase()
        return {
          address: lower,
          isCitizen: !!isCitizenByAddress[lower],
          vMOONEY: addressToVMOONEY[lower] || 0,
          power: addressToQuadraticVotingPower[lower] || 0,
          rawDistribution: { ...d.distribution },
        }
      })
      .sort((a, b) => b.power - a.power)

    const contributions: RetroactiveAudit['contributions'] = {}
    for (const project of eligibleProjects) {
      const projectId = String(project.id)
      const contributorSet = new Set(projectIdToContributors[projectId] || [])
      const rows: RetroactiveAudit['contributions'][string] = []
      for (const voter of voters) {
        if (!voter.isCitizen) continue // see RetroactiveAudit doc for rationale
        const rawVal = voter.rawDistribution[projectId]
        const normalizedVal = lowerToNormalized[voter.address]?.[projectId] || 0
        if (
          (rawVal == null || rawVal === 0) &&
          (!Number.isFinite(normalizedVal) || normalizedVal === 0)
        ) {
          continue
        }
        rows.push({
          voterAddress: voter.address,
          isContributor: contributorSet.has(voter.address),
          rawPct: typeof rawVal === 'number' ? rawVal : null,
          normalizedPct: Number.isFinite(normalizedVal) ? normalizedVal : 0,
        })
      }
      // Highest weighted contribution first so the audit page can
      // spotlight the top supporters without re-sorting client-side.
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
      projectIdToContributors,
    }
  }

  return {
    quarter,
    year,
    voteCount: distributions.length,
    voterCount: voteAddresses.length,
    citizenVoterCount: citizenDistributions.length,
    voteCloseTimestamp,
    totalCitizenPower,
    totalPower,
    pool: {
      primaryAsset: isEthPayoutCycle ? 'ETH' : 'USDC',
      primaryAmount,
      mooneyAmount,
      communityCirclePrimary,
      communityCircleMooney,
    },
    results,
    computedAt: Math.floor(Date.now() / 1000),
    ...(audit ? { audit } : {}),
  }
}
