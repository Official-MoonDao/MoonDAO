import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_CYCLE,
  PROJECT_TABLE_NAMES,
  DISTRIBUTION_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
} from 'const/config'
import type { ProjectCyclePhase } from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import { useRouter } from 'next/router'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import {
  getLivePhaseOverride,
  resolveLivePhase,
  resolveMemberVoteSubmissionsOpen,
} from '@/lib/operator/cyclePhase'
import {
  getProjectDisplayName,
  isUntitledLike,
  UNTITLED_FALLBACK,
} from '@/lib/project/getProjectDisplayName'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter, isRewardsCycle } from '@/lib/utils/dates'
import { ProjectRewards, ProjectRewardsProps } from '@/components/nance/ProjectRewards'

export default function Projects({
  proposals,
  currentProjects,
  pastProjects,
  distributions,
  proposalAllocations,
  initialLivePhase,
  initialMemberVoteSubmissionsOpen,
}: ProjectRewardsProps & {
  proposalAllocations: any[]
  initialLivePhase: ProjectCyclePhase
  initialMemberVoteSubmissionsOpen: boolean
}) {
  const router = useRouter()
  useChainDefault()
  return (
    <ProjectRewards
      proposals={proposals}
      currentProjects={currentProjects}
      pastProjects={pastProjects}
      distributions={distributions}
      proposalAllocations={proposalAllocations}
      initialLivePhase={initialLivePhase}
      initialMemberVoteSubmissionsOpen={initialMemberVoteSubmissionsOpen}
      refreshRewards={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  // Resolve the live cycle phase (operator override in KV, else the
  // PROJECT_CYCLE.phase default) so ISR renders match the current phase
  // without a redeploy. Retro rewards run concurrently with the Member Vote.
  const livePhaseOverride = await getLivePhaseOverride()
  const livePhase = resolveLivePhase(livePhaseOverride)
  const memberVoteSubmissionsOpen = resolveMemberVoteSubmissionsOpen(
    livePhase,
    livePhaseOverride
  )
  const rewardsActive = livePhase === 'member'

  const emptyProps = {
    proposals: [] as Project[],
    currentProjects: [] as Project[],
    pastProjects: [] as Project[],
    distributions: [] as any[],
    proposalAllocations: [] as any[],
    initialLivePhase: livePhase,
    initialMemberVoteSubmissionsOpen: memberVoteSubmissionsOpen,
  }

  try {
    const { quarter, year } = getRelativeQuarter(
      isRewardsCycle(new Date(), rewardsActive) ? -1 : 0
    )

    // The projects table is the one genuinely required read. If it fails
    // there is nothing to render, so fall back to the empty state. Every
    // *other* external dependency below is best-effort and must never be
    // able to blank the whole page — a single flaky IPFS gateway response
    // or a temp-check batch-read hiccup previously took down all four tabs
    // at once because the entire function shared one try/catch.
    let projects: Project[] = []
    try {
      const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
      projects = (await queryTable(chain, projectStatement)) || []
    } catch (error) {
      console.error('[projects] Failed to load the project table:', error)
      return { props: emptyProps, revalidate: 60 }
    }

    // Proposal cohort = PROJECT_CYCLE.quarter/year — the same source
    // advance-phase uses when batch-tallying Senate votes. Do NOT use
    // getRelativeQuarter(0) here: at a calendar boundary or with a stale
    // config roll those diverge and operators would close a different set
    // of MDPs than the proposals shown on the page. Also avoid
    // getSubmissionQuarter(): past its ~3-week cutoff it advances to the
    // *next* quarter and would make in-flight Q{n} proposals vanish.
    const activeProposalQuarter = {
      quarter: PROJECT_CYCLE.quarter,
      year: PROJECT_CYCLE.year,
    }
    const proposals: Project[] = []
    const currentProjects: Project[] = []
    const pastProjects: Project[] = []

    const isCurrentPending = (project: Project) =>
      project.active == PROJECT_PENDING &&
      project.quarter === activeProposalQuarter.quarter &&
      project.year === activeProposalQuarter.year &&
      !BLOCKED_PROJECTS.has(project.id) &&
      !BLOCKED_MDPS.has(project.MDP)

    // Temp-check (Senate) approval/failure flags are best-effort metadata that
    // only pending, current-cycle proposals actually consume. Scope the batch
    // read to just those MDPs instead of every project in the table: reading
    // all ~N projects in a single multicall is both wasteful and the exact
    // pattern that tips the Engine call over its size/time limit as the
    // project count grows — which would otherwise take down the whole page.
    // If the read fails we simply proceed without Senate flags.
    const pendingMdps = Array.from(
      new Set(projects.filter(isCurrentPending).map((p) => p.MDP))
    )
    const tempCheckByMdp = new Map<
      any,
      { approved?: string; failed?: string }
    >()
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
          '[projects] Temp-check batch read failed; continuing without Senate flags:',
          error
        )
      }
    }

    await Promise.all(
      projects.map(async (project: Project) => {
        if (BLOCKED_PROJECTS.has(project.id) || BLOCKED_MDPS.has(project.MDP)) {
          return
        }
        const activeStatus = project.active
        if (isCurrentPending(project)) {
          if (!project.proposalIPFS) return
          const { approved, failed } = tempCheckByMdp.get(project.MDP) ?? {}
          try {
            const proposalResponse = await fetch(project.proposalIPFS)
            const proposalJSON = await proposalResponse.json()
            if (proposalJSON?.nonProjectProposal) return
            // Author-deleted proposals disappear from the frontend.
            if (proposalJSON?.deleted) return
            // Enrich name from IPFS while we have the JSON in hand
            if (isUntitledLike(project.name)) {
              const resolved = getProjectDisplayName(project, proposalJSON)
              if (resolved !== UNTITLED_FALLBACK) project.name = resolved
            }
            project.tempCheckApproved = approved
            project.tempCheckFailed = failed
            if (!failed) {
              proposals.push(project)
            }
          } catch (error) {
            // A flaky IPFS gateway must not silently drop a live proposal (or,
            // worse, blank the page). Include it as long as the temp-check
            // didn't mark it failed; the client-side ProjectCard re-fetches the
            // JSON for full display.
            console.warn(
              `[projects] proposal IPFS fetch failed for MDP ${project.MDP}; including with cached metadata:`,
              error
            )
            project.tempCheckApproved = approved
            project.tempCheckFailed = failed
            if (!failed) {
              proposals.push(project)
            }
          }
        } else if (activeStatus == PROJECT_ACTIVE) {
          currentProjects.push(project)
        } else {
          pastProjects.push(project)
        }
      })
    )
    // For active/past projects whose stored name is empty or "Untitled",
    // fetch the IPFS proposal JSON server-side so the pre-rendered HTML
    // already carries the real title instead of "Untitled Project".
    const untitledNonPending = [...currentProjects, ...pastProjects].filter(
      (p) => isUntitledLike(p.name) && !!p.proposalIPFS
    )
    if (untitledNonPending.length > 0) {
      await Promise.allSettled(
        untitledNonPending.map(async (project) => {
          try {
            const res = await fetch(project.proposalIPFS)
            const json = await res.json()
            const resolved = getProjectDisplayName(project, json)
            if (resolved !== UNTITLED_FALLBACK) project.name = resolved
          } catch {
            // Leave the name as-is; the client-side hook will still resolve it
          }
        })
      )
    }

    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) {
        return 0
      }
      return a.eligible ? 1 : -1
    })

    // Distributions + proposal allocations are supporting data for the
    // retroactive / member-vote tabs. A failure here must not discard the
    // proposals / projects we already assembled above, so each query gets
    // its own guard and falls back to an empty array.
    let distributions: any[] = []
    try {
      const distributionStatement = `SELECT * FROM ${DISTRIBUTION_TABLE_NAMES[chainSlug]} WHERE year = ${year} AND quarter = ${quarter}`
      distributions = (await queryTable(chain, distributionStatement)) || []
    } catch (error) {
      console.error('[projects] Failed to load distributions:', error)
    }

    // Proposal allocations (member-vote distributions) are keyed off of the
    // *current* proposal quarter — i.e. the quarter the proposals being
    // voted on belong to — NOT the rewards-shifted `quarter`/`year` used
    // for retroactive payouts. Mixing the two surfaces an old member-vote
    // row from the prior quarter and incorrectly flips the UI into "Edit
    // Distribution" mode.
    let proposalAllocations: any[] = []
    try {
      const proposalAllocationStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE year = ${activeProposalQuarter.year} AND quarter = ${activeProposalQuarter.quarter}`
      proposalAllocations = (await queryTable(chain, proposalAllocationStatement)) || []
    } catch (error) {
      console.error('[projects] Failed to load proposal allocations:', error)
    }

    return {
      props: {
        proposals: proposals.sort((a, b) => b.id - a.id),
        currentProjects: currentProjects.reverse(),
        pastProjects: pastProjects.reverse(),
        distributions,
        proposalAllocations,
        initialLivePhase: livePhase,
        initialMemberVoteSubmissionsOpen: memberVoteSubmissionsOpen,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching projects or distributions:', error)
    return { props: emptyProps, revalidate: 60 }
  }
}
