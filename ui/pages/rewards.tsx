import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { useRouter } from 'next/router'
import { getContract, readContract } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter } from '@/lib/utils/dates'
import {
  RetroactiveRewards,
  RetroactiveRewardsProps,
} from '../components/nance/RetroactiveRewards'

export default function Rewards({
  projects,
  distributions,
}: RetroactiveRewardsProps) {
  const router = useRouter()
  useChainDefault()
  return (
    <RetroactiveRewards
      projects={projects}
      distributions={distributions}
      refreshRewards={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: ProjectTableABI as any,
    })

    const distributionTableContract = getContract({
      client: serverClient,
      address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: DistributionABI as any,
    })

    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const distributionTableName = await readContract({
      contract: distributionTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const { quarter, year } = getRelativeQuarter(-1)

    const projectStatement = `SELECT * FROM ${projectTableName} WHERE year = ${year} AND quarter = ${quarter}`
    const projectsRes = await fetch(
      `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
    )
    const projects = await projectsRes.json()

    const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${year} AND quarter = ${quarter}`
    const distributionsRes = await fetch(
      `${TABLELAND_ENDPOINT}?statement=${distributionStatement}`
    )
    const distributions = await distributionsRes.json()

    return {
      props: {
        projects,
        distributions,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching projects or distributions:', error)
    return {
      props: {
        projects: [],
        distributions: [],
      },
      revalidate: 60,
    }
  }
}
