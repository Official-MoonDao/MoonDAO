import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { useRouter } from 'next/router'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
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
      chain,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
    })

    const distributionTableContract = getContract({
      client: serverClient,
      chain,
      address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
      abi: DistributionABI as any,
    })

    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName',
    })
    const distributionTableName = await readContract({
      contract: distributionTableContract,
      method: 'getTableName',
    })

    const { quarter, year } = getRelativeQuarter(-1)

    const projectStatement = `SELECT * FROM ${projectTableName} WHERE year = ${year} AND quarter = ${quarter}`
    const projects = await queryTable(chain, projectStatement)

    const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${year} AND quarter = ${quarter}`
    let distributions = await queryTable(chain, distributionStatement)
    distributions = distributions.concat([
      {
        year: 2024,
        quarter: 4,
        // mitchie
        address: '0x9fDf876a50EA8f95017dCFC7709356887025B5BB',
        distribution: { '1': 100 },
      },
      {
        year: 2024,
        quarter: 4,
        // coffee-crusher.eth
        address: '0x223da87421786DD8960bf2350e6c499BEbCA64d1',
        distribution: { '0': 35, '1': 40, '2': 25 },
      },
      {
        year: 2024,
        quarter: 4,
        // titan
        address: '0x86c779b3741e83A36A2a236780d436E4EC673Af4',
        distribution: { '0': 100 },
      },
      {
        year: 2024,
        quarter: 4,
        // colin
        address: '0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6',
        distribution: { '1': 65, '2': 35 },
      },
      {
        year: 2024,
        quarter: 4,
        // ryan
        address: '0x78176eaabcb3255e898079dc67428e15149cdc99',
        distribution: {},
      },
    ])
    distributions[3].distribution = { '1': 100 }
    distributions[0].distribution = { '1': 100 }

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
