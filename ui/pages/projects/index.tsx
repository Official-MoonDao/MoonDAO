import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_NAMES,
  DISTRIBUTION_TABLE_NAMES,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import { useRouter } from 'next/router'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter, isRewardsCycle } from '@/lib/utils/dates'
import {
  RetroactiveRewards,
  RetroactiveRewardsProps,
} from '@/components/nance/RetroactiveRewards'

export default function Rewards({
  currentProjects,
  pastProjects,
  distributions,
}: RetroactiveRewardsProps) {
  const router = useRouter()
  useChainDefault()
  return (
    <RetroactiveRewards
      currentProjects={currentProjects}
      pastProjects={pastProjects}
      distributions={distributions}
      refreshRewards={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const { quarter, year } = getRelativeQuarter(
      isRewardsCycle(new Date()) ? -1 : 0
    )
    const distributionStatement = `SELECT * FROM ${DISTRIBUTION_TABLE_NAMES[chainSlug]}`
    console.log('distributionStatement', distributionStatement)
    const distributions = await queryTable(chain, distributionStatement)
    console.log('distributions', distributions)

    const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = await queryTable(chain, projectStatement)

    const currentProjects = []
    const pastProjects = []
    for (let i = 0; i < projects.length; i++) {
      if (!blockedProjects.includes(projects[i].id)) {
        const current = projects[i].active
        if (!current) {
          pastProjects.push(projects[i])
        } else {
          currentProjects.push(projects[i])
        }
      }
    }
    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) {
        return 0
      }
      return a.eligible ? 1 : -1
    })

    return {
      props: {
        currentProjects: currentProjects.reverse(),
        pastProjects: pastProjects.reverse(),
        distributions,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching projects or distributions:', error)
    return {
      props: {
        currentProjects: [],
        pastProjects: [],
        distributions: [],
      },
      revalidate: 60,
    }
  }
}
