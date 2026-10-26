import {
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_NAMES,
  DISTRIBUTION_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import type { ProjectCyclePhase } from 'const/config'
import { useRouter } from 'next/router'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import {
  getLivePhaseOverride,
  resolveLivePhase,
  resolveMemberVoteSubmissionsOpen,
} from '@/lib/operator/cyclePhase'
import { excludeNonProjectProposals } from '@/lib/project/excludeNonProjectProposals'
import {
  getCurrentCycleProposals,
  isCurrentCyclePending,
} from '@/lib/project/getCurrentCycleProposals'
import {
  getProjectDisplayName,
  isUntitledLike,
  UNTITLED_FALLBACK,
} from '@/lib/project/getProjectDisplayName'
import { isBlockedProject } from '@/lib/project/isBlockedProject'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getProposalCycle, getRetroCohort } from '@/lib/projectCycle/cycleQuarters'
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
    const { quarter, year } = getRetroCohort()

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

    const activeProposalQuarter = getProposalCycle()
    const proposals = await getCurrentCycleProposals(projects, chain)
    let currentProjects: Project[] = []
    const pastProjects: Project[] = []

    for (const project of projects) {
      // Current-cycle pending rows are handled by getCurrentCycleProposals;
      // the ones it drops (Senate-failed, governance, deleted) stay hidden.
      if (isBlockedProject(project) || isCurrentCyclePending(project)) continue
      if (project.active == PROJECT_ACTIVE) {
        currentProjects.push(project)
      } else {
        pastProjects.push(project)
      }
    }
    // Governance proposals that pass are written active, same as funded
    // projects. Pending rows already skip `nonProjectProposal` in
    // getCurrentCycleProposals.
    currentProjects = await excludeNonProjectProposals(currentProjects)
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
