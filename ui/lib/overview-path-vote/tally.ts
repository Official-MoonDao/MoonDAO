import { PATH_VOTE_OPTIONS } from './options'
import { isPathVoteOptionId } from './options'
import type { PathVoteOptionId } from './options'
import type { PathVoteResult, PathVoteResults, PathVoteVoter } from './fetchResults'

export type ParsedPathVote = {
  voterAddress: string
  optionId: PathVoteOptionId
  storedAmount: number
}

const EMPTY_TOTALS: Record<
  PathVoteOptionId,
  { totalVoted: number; voterCount: number }
> = {
  'option-a': { totalVoted: 0, voterCount: 0 },
  'option-b': { totalVoted: 0, voterCount: 0 },
  'option-c': { totalVoted: 0, voterCount: 0 },
  abstain: { totalVoted: 0, voterCount: 0 },
}

export function parsePathVotes(rows: any[]): ParsedPathVote[] {
  const votes: ParsedPathVote[] = []
  for (const row of rows) {
    try {
      const vote =
        typeof row.vote === 'string' ? JSON.parse(row.vote) : row.vote
      const entries = Object.entries(vote)
      if (entries.length > 0) {
        const [optionId, amount] = entries[0]
        if (!isPathVoteOptionId(optionId)) continue
        votes.push({
          voterAddress: (row.address as string).toLowerCase(),
          optionId,
          storedAmount: Number(amount) || 0,
        })
      }
    } catch {
      continue
    }
  }
  return votes
}

/**
 * Aggregates parsed path votes by option, weighting each voter by their live
 * $OVERVIEW balance (same anti-gaming semantics as the overview delegation
 * leaderboard). When balance is non-finite (RPC fallback sentinel), uses the
 * stored amount recorded at vote time.
 */
export function aggregatePathVotes(
  votes: ParsedPathVote[],
  balanceMap: Record<string, number>
): {
  totals: Record<PathVoteOptionId, { totalVoted: number; voterCount: number }>
  voters: PathVoteVoter[]
  totalVoted: number
  totalVoters: number
} {
  const totals = {
    'option-a': { ...EMPTY_TOTALS['option-a'] },
    'option-b': { ...EMPTY_TOTALS['option-b'] },
    'option-c': { ...EMPTY_TOTALS['option-c'] },
    abstain: { ...EMPTY_TOTALS.abstain },
  }

  for (const v of votes) {
    const currentBalance = balanceMap[v.voterAddress] ?? 0
    const effective = Number.isFinite(currentBalance)
      ? currentBalance
      : v.storedAmount
    if (effective <= 0) continue
    totals[v.optionId].totalVoted += effective
    totals[v.optionId].voterCount += 1
  }

  const voters: PathVoteVoter[] = votes
    .map((v) => {
      const bal = balanceMap[v.voterAddress] ?? 0
      const power = Number.isFinite(bal) ? bal : v.storedAmount
      return {
        address: v.voterAddress,
        votingPower: Math.round(power * 100) / 100,
        optionId: v.optionId,
      }
    })
    .filter((v) => v.votingPower > 0)
    .sort((a, b) => b.votingPower - a.votingPower)

  const totalVoted = Object.values(totals).reduce(
    (sum, t) => sum + t.totalVoted,
    0
  )
  const totalVoters = Object.values(totals).reduce(
    (sum, t) => sum + t.voterCount,
    0
  )

  return { totals, voters, totalVoted, totalVoters }
}

/**
 * Picks the winning option as the non-abstain path with the most voting power.
 * Returns null when nothing leads (no votes) or there is an exact tie for first.
 */
export function computePathVoteWinner(
  results: { optionId: PathVoteOptionId; totalVoted: number }[]
): PathVoteOptionId | null {
  const substantive = results.filter((r) => r.optionId !== 'abstain')
  let leader: PathVoteOptionId | null = null
  let leaderTotal = 0
  let tied = false
  for (const r of substantive) {
    if (r.totalVoted > leaderTotal) {
      leader = r.optionId
      leaderTotal = r.totalVoted
      tied = false
    } else if (r.totalVoted === leaderTotal && leaderTotal > 0) {
      tied = true
    }
  }
  if (leaderTotal <= 0 || tied) return null
  return leader
}

export function buildPathVoteResults(
  totals: Record<PathVoteOptionId, { totalVoted: number; voterCount: number }>,
  voters: PathVoteVoter[],
  totalVoted: number,
  totalVoters: number
): PathVoteResults {
  const results: PathVoteResult[] = PATH_VOTE_OPTIONS.map((o) => ({
    optionId: o.id,
    totalVoted: Math.round(totals[o.id].totalVoted * 100) / 100,
    voterCount: totals[o.id].voterCount,
    percentage:
      totalVoted > 0
        ? Math.round((totals[o.id].totalVoted / totalVoted) * 1000) / 10
        : 0,
  }))

  return {
    results,
    totalVoted: Math.round(totalVoted * 100) / 100,
    totalVoters,
    voters,
    winningOptionId: computePathVoteWinner(results),
  }
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

/**
 * User-facing copy for the "voting closed" banner. Safe for SSR when the vote
 * is closed via OVERVIEW_PATH_VOTE_CLOSED without an OVERVIEW_PATH_VOTE_DEADLINE.
 */
export function formatVoteClosedMessage(
  deadline: Date | null,
  snapshotGeneratedAt?: string | null
): string {
  if (deadline && !Number.isNaN(deadline.getTime())) {
    return `Voting closed on ${deadline.toLocaleDateString(undefined, DATE_FORMAT)}. Results below are final.`
  }
  if (snapshotGeneratedAt) {
    const closedAt = new Date(snapshotGeneratedAt)
    if (!Number.isNaN(closedAt.getTime())) {
      return `Voting closed on ${closedAt.toLocaleDateString(undefined, DATE_FORMAT)}. Results below are final.`
    }
  }
  return 'Voting is now closed. Results below are final.'
}
