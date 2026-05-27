/**
 * Per-MDP Member Vote tally with Abstain-aware supermajority semantics.
 *
 * The non-project Member Vote uses three choice keys mirrored in
 * `VotingModal.tsx`: '1' = For, '2' = Against, '3' = Abstain. Pass/fail
 * is decided by a 66.6% supermajority of voters who took a side —
 * Abstain is "present, not voting" and must be excluded from the
 * For/Against denominator. Otherwise a single large-VP abstainer can
 * mathematically prevent a unanimous-of-decided-voters proposal from
 * clearing the threshold (see MDP-249: 91% For of decided VP, but
 * 35.58% For of total VP because three large holders abstained).
 *
 * This helper is the single source of truth used by:
 *   - `pages/api/proposals/nonProjectVote.ts` (the on-chain close-and-
 *     tally handler) for its pass/fail decision.
 *   - `pages/project/[tokenId].tsx` `getServerSideProps` to render the
 *     same outcome on the proposal page.
 *
 * Keep both call sites consuming this helper so the displayed tally
 * and the on-chain tally can never disagree.
 */

const FOR_KEY = '1'
const AGAINST_KEY = '2'
const ABSTAIN_KEY = '3'

export const MEMBER_VOTE_SUPER_MAJORITY = 66.6

export type MemberVoteRow = {
  address: string
  // Choice id ('1' | '2' | '3') → percent of the voter's allocation
  // (single-click votes are always 100/0/0 but the schema still
  // supports split votes, so we treat percentages generally).
  vote?: Record<string, number> | string
  distribution?: Record<string, number> | string
}

export type MemberVoteTally = {
  /** Sum of √vMOONEY across voters who picked any choice. */
  totalParticipationVP: number
  /** √vMOONEY weighted by allocation pct, summed over For voters. */
  forVP: number
  /** √vMOONEY weighted by allocation pct, summed over Against voters. */
  againstVP: number
  /** √vMOONEY weighted by allocation pct, summed over Abstain voters. */
  abstainVP: number
  /** forVP + againstVP — the denominator for the supermajority test. */
  decidedVP: number
  /**
   * For / decided × 100. This is the number we test against the
   * supermajority threshold. 0 when no one took a side (purely
   * abstain or empty turnout).
   */
  forPctOfDecided: number
  /** Against / decided × 100 — sums to 100 with `forPctOfDecided`. */
  againstPctOfDecided: number
  /**
   * Abstain / total turnout × 100 — informational. Lets the UI say
   * "X% of voters abstained" without conflating with the
   * for/against percentages of decided VP.
   */
  abstainShareOfTurnout: number
  /** True iff `forPctOfDecided >= MEMBER_VOTE_SUPER_MAJORITY`. */
  passed: boolean
}

function parseVote(row: MemberVoteRow): Record<string, number> {
  const raw = row.vote ?? row.distribution
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object') return raw
  return {}
}

/**
 * Compute the Abstain-aware tally for a Member Vote.
 *
 * @param votes  Per-voter rows from the `NonProjectProposal_*`
 *               table (or the `resolveSnapshotMemberProposalVotes`
 *               helper). Address is matched case-insensitively
 *               against `addressToQuadraticVotingPower`.
 * @param addressToQuadraticVotingPower  address → √vMOONEY at the
 *                                        canonical close moment.
 *                                        Voters missing from this
 *                                        map count as 0 VP (matches
 *                                        the live fetcher's failure
 *                                        mode and `runQuadraticVoting`).
 */
export function computeMemberProposalTally(
  votes: MemberVoteRow[] | undefined,
  addressToQuadraticVotingPower: Record<string, number>
): MemberVoteTally {
  // Build a case-insensitive view of the VP map. Tableland echoes
  // mixed-case addresses for some validators while our snapshot
  // resolver always lowercases, so look both ways.
  const lowerVP: Record<string, number> = {}
  for (const [addr, power] of Object.entries(
    addressToQuadraticVotingPower ?? {}
  )) {
    if (typeof addr !== 'string') continue
    lowerVP[addr.toLowerCase()] =
      typeof power === 'number' && Number.isFinite(power) && power >= 0
        ? power
        : 0
  }

  let forVP = 0
  let againstVP = 0
  let abstainVP = 0
  let totalParticipationVP = 0

  for (const row of votes ?? []) {
    if (!row || typeof row.address !== 'string') continue
    const lower = row.address.toLowerCase()
    const power = lowerVP[lower] ?? 0
    if (power <= 0) continue
    const dist = parseVote(row)
    const pctFor = Number(dist[FOR_KEY]) || 0
    const pctAgainst = Number(dist[AGAINST_KEY]) || 0
    const pctAbstain = Number(dist[ABSTAIN_KEY]) || 0
    // Single-click votes always sum to 100 across one choice; split
    // votes (older format) sum to 100 across multiple choices.
    // Either way, divide by 100 so we accumulate in raw-VP units
    // rather than VP×percent-points.
    forVP += (power * pctFor) / 100
    againstVP += (power * pctAgainst) / 100
    abstainVP += (power * pctAbstain) / 100
    // Total participation = anyone who allocated to any choice. Don't
    // count voters whose row exists but has an empty distribution,
    // since they didn't actually express a preference.
    if (pctFor > 0 || pctAgainst > 0 || pctAbstain > 0) {
      totalParticipationVP += power
    }
  }

  const decidedVP = forVP + againstVP
  const forPctOfDecided = decidedVP > 0 ? (forVP / decidedVP) * 100 : 0
  const againstPctOfDecided =
    decidedVP > 0 ? (againstVP / decidedVP) * 100 : 0
  const abstainShareOfTurnout =
    totalParticipationVP > 0
      ? (abstainVP / totalParticipationVP) * 100
      : 0

  return {
    totalParticipationVP,
    forVP,
    againstVP,
    abstainVP,
    decidedVP,
    forPctOfDecided,
    againstPctOfDecided,
    abstainShareOfTurnout,
    passed: forPctOfDecided >= MEMBER_VOTE_SUPER_MAJORITY,
  }
}
