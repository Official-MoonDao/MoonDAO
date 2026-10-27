import ProposalsABI from 'const/abis/Proposals.json'
import { PROPOSALS_ADDRESSES } from 'const/config'
import { PROJECT_PENDING } from '@/lib/nance/types'
import {
  getProjectDisplayName,
  isUntitledLike,
  UNTITLED_FALLBACK,
} from '@/lib/project/getProjectDisplayName'
import { isBlockedProject } from '@/lib/project/isBlockedProject'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { getProposalCycle } from '@/lib/projectCycle/cycleQuarters'

const PROPOSAL_IPFS_TIMEOUT_MS = 10_000

// Proposal cohort = PROJECT_CYCLE.quarter/year — the same source
// advance-phase uses when batch-tallying Senate votes. Do NOT use
// getRelativeQuarter(0) here: at a calendar boundary or with a stale
// config roll those diverge and operators would close a different set
// of MDPs than the proposals shown on the page. Also avoid
// getSubmissionQuarter(): past its ~3-week cutoff it advances to the
// *next* quarter and would make in-flight Q{n} proposals vanish.
export function isCurrentCyclePending(project: Project) {
  const activeProposalQuarter = getProposalCycle()
  return (
    project.active == PROJECT_PENDING &&
    project.quarter === activeProposalQuarter.quarter &&
    project.year === activeProposalQuarter.year &&
    !isBlockedProject(project)
  )
}

/**
 * Pending project proposals in the current proposal cycle that are still
 * live: either awaiting the Senate vote or approved for the Member Vote.
 * Shared by /projects and the dashboard so both agree on what is open.
 *
 * Senate failure is only recorded on-chain (`tempCheckFailed`); the project
 * table keeps `active = PENDING`, so the flags must be read here.
 * Governance (non-project) and author-deleted proposals are excluded.
 * Each returned row carries `tempCheckApproved` / `tempCheckFailed`.
 */
export async function getCurrentCycleProposals(
  projects: Project[],
  chain: any
): Promise<Project[]> {
  const chainSlug = getChainSlug(chain)

  const pending = projects.filter(isCurrentCyclePending)

  // Temp-check (Senate) approval/failure flags are best-effort metadata that
  // only pending, current-cycle proposals actually consume. Scope the batch
  // read to just those MDPs instead of every project in the table: reading
  // all ~N projects in a single multicall is both wasteful and the exact
  // pattern that tips the Engine call over its size/time limit as the
  // project count grows — which would otherwise take down the whole page.
  // If the read fails we simply proceed without Senate flags.
  const pendingMdps = Array.from(new Set(pending.map((p) => p.MDP)))
  const tempCheckByMdp = new Map<any, { approved?: string; failed?: string }>()
  if (pendingMdps.length > 0) {
    try {
      const { engineBatchRead } = await import('@/lib/thirdweb/engine')
      const mdpArgs = pendingMdps.map((mdp) => [mdp])
      const [approveds, faileds] = await Promise.all([
        engineBatchRead<string>(
          PROPOSALS_ADDRESSES[chainSlug],
          'tempCheckApproved',
          mdpArgs,
          ProposalsABI.abi,
          chain.id
        ),
        engineBatchRead<string>(
          PROPOSALS_ADDRESSES[chainSlug],
          'tempCheckFailed',
          mdpArgs,
          ProposalsABI.abi,
          chain.id
        ),
      ])
      pendingMdps.forEach((mdp, i) => {
        tempCheckByMdp.set(mdp, {
          approved: approveds[i],
          failed: faileds[i],
        })
      })
    } catch (error) {
      console.error(
        '[proposals] Temp-check batch read failed; continuing without Senate flags:',
        error
      )
    }
  }

  const proposals: Project[] = []
  await Promise.all(
    pending.map(async (project: Project) => {
      if (!project.proposalIPFS) return
      const { approved, failed } = tempCheckByMdp.get(project.MDP) ?? {}
      try {
        const proposalResponse = await fetch(project.proposalIPFS, {
          signal: AbortSignal.timeout(PROPOSAL_IPFS_TIMEOUT_MS),
        })
        const proposalJSON = await proposalResponse.json()
        if (proposalJSON?.nonProjectProposal) return
        // Author-deleted proposals disappear from the frontend.
        if (proposalJSON?.deleted) return
        // Enrich name from IPFS while we have the JSON in hand
        if (isUntitledLike(project.name)) {
          const resolved = getProjectDisplayName(project, proposalJSON)
          if (resolved !== UNTITLED_FALLBACK) project.name = resolved
        }
      } catch (error) {
        // A flaky IPFS gateway must not silently drop a live proposal (or,
        // worse, blank the page). Include it as long as the temp-check
        // didn't mark it failed; the client-side card re-fetches the JSON
        // for full display.
        console.warn(
          `[proposals] proposal IPFS fetch failed for MDP ${project.MDP}; including with cached metadata:`,
          error
        )
      }
      // Leave the flags unset (not undefined) when the batch read failed, so
      // the row still serializes through getStaticProps.
      if (approved !== undefined) project.tempCheckApproved = approved
      if (failed !== undefined) project.tempCheckFailed = failed
      if (!failed) {
        proposals.push(project)
      }
    })
  )
  return proposals
}
