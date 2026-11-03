/**
 * Proposals shown on the Project Proposals tab.
 *
 * The tab badge, the card list, and the member-vote allocation keys all
 * have to use this same set. Counting `proposals.length` includes rows the
 * list hides: during the Member Vote that is every proposal the Senate has
 * not approved, and during the Senate vote it is every proposal already
 * approved.
 *
 * Outside the Senate vote, a proposal that received votes but finished under
 * quorum is a failure. `Proposals.tallyVotes` does not set `tempCheckFailed`
 * in that case, so the project row stays `PENDING` forever unless the list
 * drops it here. A proposal with zero Senate votes has not been balloted yet
 * and stays visible. During the Senate vote the same row stays on the ballot.
 */
export function visibleCycleProposals<
  T extends {
    tempCheckApproved?: unknown
    tempCheckFailed?: unknown
    tempCheckVoteCount?: unknown
    senateQuorum?: unknown
  }
>(
  proposals: readonly T[] | null | undefined,
  phase: { isSenateVote: boolean; isMemberVote: boolean }
): T[] {
  if (!proposals?.length) return []
  return proposals.filter((project) => {
    if (project.tempCheckFailed) return false
    if (!phase.isSenateVote && isSenateClosedBelowQuorum(project)) return false
    if (phase.isSenateVote) return !project.tempCheckApproved
    if (phase.isMemberVote) return Boolean(project.tempCheckApproved)
    return true
  })
}

function asCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/**
 * Senate ballots that closed under quorum. `tallyVotes` is a no-op until
 * `tempCheckVoteCount >= getQuorum()`, so these rows never flip to
 * `tempCheckFailed`. Zero votes means the proposal was not in that ballot.
 */
export function isSenateClosedBelowQuorum(project: {
  tempCheckApproved?: unknown
  tempCheckVoteCount?: unknown
  senateQuorum?: unknown
}): boolean {
  if (project.tempCheckApproved) return false
  const votes = asCount(project.tempCheckVoteCount)
  const quorum = asCount(project.senateQuorum)
  if (votes == null || quorum == null || quorum <= 0) return false
  return votes > 0 && votes < quorum
}
