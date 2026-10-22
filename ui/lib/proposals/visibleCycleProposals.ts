/**
 * Proposals shown on the Project Proposals tab.
 *
 * The tab badge, the card list, and the member-vote allocation keys all
 * have to use this same set. Counting `proposals.length` includes rows the
 * list hides: during the Member Vote that is every proposal the Senate has
 * not approved, and during the Senate vote it is every proposal already
 * approved.
 */
export function visibleCycleProposals<
  T extends {
    tempCheckApproved?: unknown
    tempCheckFailed?: unknown
  }
>(
  proposals: readonly T[] | null | undefined,
  phase: { isSenateVote: boolean; isMemberVote: boolean }
): T[] {
  if (!proposals?.length) return []
  return proposals.filter((project) => {
    if (project.tempCheckFailed) return false
    if (phase.isSenateVote) return !project.tempCheckApproved
    if (phase.isMemberVote) return Boolean(project.tempCheckApproved)
    return true
  })
}
