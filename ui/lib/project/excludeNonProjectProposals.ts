type ProposalRow = {
  proposalIPFS?: string | null
  MDP?: number | string | null
}

const PROPOSAL_IPFS_TIMEOUT_MS = 10_000

/**
 * Passed governance proposals are stored with the same active flag as funded
 * projects. Their proposal JSON sets `nonProjectProposal`, and they belong
 * on /governance-proposals rather than the active-project lists.
 *
 * A failed or timed-out IPFS read keeps the row. A flaky gateway must not
 * hide a real project.
 */
export async function excludeNonProjectProposals<T extends ProposalRow>(
  projects: T[]
): Promise<T[]> {
  const nonProject = await Promise.all(projects.map((project) => isNonProjectProposal(project)))
  return projects.filter((_, index) => !nonProject[index])
}

async function isNonProjectProposal(project: ProposalRow): Promise<boolean> {
  const uri = project.proposalIPFS
  if (!uri) return false
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(PROPOSAL_IPFS_TIMEOUT_MS) })
    if (!res.ok) {
      console.warn(
        `[projects] proposal IPFS HTTP ${res.status} for MDP ${project.MDP}; keeping project`
      )
      return false
    }
    const json = await res.json()
    return Boolean(json?.nonProjectProposal)
  } catch (error) {
    console.warn(
      `[projects] proposal IPFS fetch failed for MDP ${project.MDP}; keeping project:`,
      error
    )
    return false
  }
}
