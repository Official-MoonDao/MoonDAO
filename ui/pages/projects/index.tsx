import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_NAMES,
  DISTRIBUTION_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
} from 'const/config'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import { useRouter } from 'next/router'
import { getContract, readContract } from 'thirdweb'
import { PROJECT_ACTIVE, PROJECT_ENDED, PROJECT_PENDING } from '@/lib/nance/types'
import { getProposalStatus } from '@/lib/nance/useProposalStatus'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter, isRewardsCycle } from '@/lib/utils/dates'
import { ProjectRewards, ProjectRewardsProps } from '@/components/nance/ProjectRewards'

export default function Projects({
  proposals,
  currentProjects,
  pastProjects,
  distributions,
  proposalAllocations,
}: ProjectRewardsProps & { proposalAllocations: any[] }) {
  const router = useRouter()
  useChainDefault()
  return (
    <ProjectRewards
      proposals={proposals}
      currentProjects={currentProjects}
      pastProjects={pastProjects}
      distributions={distributions}
      proposalAllocations={proposalAllocations}
      refreshRewards={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const { quarter, year } = getRelativeQuarter(isRewardsCycle(new Date()) ? -1 : 0)

    const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = (await queryTable(chain, projectStatement)) || []
    const proposalContract = getContract({
      client: serverClient,
      address: PROPOSALS_ADDRESSES[chainSlug],
      abi: ProposalsABI.abi as any,
      chain: chain,
    })

    const proposals: Project[] = []
    const currentProjects: Project[] = []
    const pastProjects: Project[] = []
    const { engineBatchRead } = await import('@/lib/thirdweb/engine')
    const approveds = await engineBatchRead<string>(
      PROPOSALS_ADDRESSES[chainSlug],
      'tempCheckApproved',
      projects.map((project: Project) => [project.MDP]),
      ProposalsABI.abi,
      chain.id
    )

    await Promise.all(
      projects.map(async (project: Project, index: number) => {
        if (!BLOCKED_PROJECTS.has(project.id)) {
          const activeStatus = project.active
          if (activeStatus == PROJECT_PENDING) {
            const proposalResponse = await fetch(project.proposalIPFS)
            const proposalJSON = await proposalResponse.json()
            if (!proposalJSON?.nonProjectProposal) {
              project.tempCheckApproved = approveds[index]
              proposals.push(project)
            }
          } else if (activeStatus == PROJECT_ACTIVE) {
            currentProjects.push(project)
          } else {
            pastProjects.push(project)
          }
        }
      })
    )
    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) {
        return 0
      }
      return a.eligible ? 1 : -1
    })

    const distributionStatement = `SELECT * FROM ${DISTRIBUTION_TABLE_NAMES[chainSlug]} WHERE year = ${year} AND quarter = ${quarter}`
    const distributions = (await queryTable(chain, distributionStatement)) || []

    const proposalAllocationStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE year = ${year} AND quarter = ${quarter}`
    const proposalAllocations = (await queryTable(chain, proposalAllocationStatement)) || []

    return {
      props: {
        proposals: proposals.reverse(),
        currentProjects: currentProjects.reverse(),
        pastProjects: pastProjects.reverse(),
        distributions,
        proposalAllocations,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching projects or distributions:', error)
    return {
      props: {
        proposals: [],
        currentProjects: [],
        pastProjects: [],
        distributions: [],
        proposalAllocations: [],
      },
      revalidate: 60,
    }
  }
}
