/**
 * Who is barred from allocating to which project in the Member Vote.
 *
 * Shared by the on-chain tally (`pages/api/proposals/vote.ts`), the
 * read-only replay (`computeMemberVoteOutcome`) and the distribute UI so
 * the three can never disagree on whose allocation gets stripped.
 *
 * Rules:
 *   - The proposal author (`authorAddress` in the proposal IPFS JSON) can
 *     never vote on their own project. This has applied to every cycle.
 *   - From `TEAM_SELF_VOTE_START` onward, every wallet wearing the
 *     project's manager or member hat is barred too. Earlier cycles were
 *     tallied with the author-only rule, so their audits must keep using
 *     it to reproduce the outcome that was actually paid.
 *
 * A barred cell is omitted from the voter's row, so iterative
 * normalization fills it with the column average of the other voters.
 */
/** First Member Vote cycle that bars every project hat wearer. */
export const TEAM_SELF_VOTE_START = { quarter: 4, year: 2026 }

export function teamSelfVoteRuleApplies(quarter: number, year: number): boolean {
  return (
    year * 4 + quarter >=
    TEAM_SELF_VOTE_START.year * 4 + TEAM_SELF_VOTE_START.quarter
  )
}

/** projectId → lowercased wallets that may not allocate to that project. */
export type SelfVoteExclusions = Record<string, Set<string>>

export function buildSelfVoteExclusions({
  projectIdToAuthor,
  projectIdToTeamWallets,
}: {
  projectIdToAuthor: Record<string, string | undefined>
  /** Omit (or pass `{}`) for cycles before `TEAM_SELF_VOTE_START`. */
  projectIdToTeamWallets?: Record<string, string[]>
}): SelfVoteExclusions {
  const exclusions: SelfVoteExclusions = {}
  const add = (projectId: string, wallet: string | undefined) => {
    if (!wallet) return
    ;(exclusions[projectId] ??= new Set()).add(wallet.toLowerCase())
  }
  for (const [projectId, author] of Object.entries(projectIdToAuthor)) {
    add(projectId, author)
  }
  for (const [projectId, wallets] of Object.entries(projectIdToTeamWallets || {})) {
    for (const wallet of wallets) add(projectId, wallet)
  }
  return exclusions
}

export function isSelfVoteExcluded(
  exclusions: SelfVoteExclusions,
  projectId: string,
  voter: string | undefined
): boolean {
  if (!voter) return false
  return exclusions[projectId]?.has(voter.toLowerCase()) ?? false
}
