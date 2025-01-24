import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { initSDK } from '@/lib/thirdweb/thirdweb'
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
    const chain =
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    const sdk = initSDK(chain)

    const projectTableContract = await sdk.getContract(
      PROJECT_TABLE_ADDRESSES[chain.slug],
      ProjectTableABI
    )

    const distributionTableContract = await sdk.getContract(
      DISTRIBUTION_TABLE_ADDRESSES[chain.slug],
      DistributionABI
    )

    const projectTableName = await projectTableContract.call('getTableName')
    const distributionTableName = await distributionTableContract.call(
      'getTableName'
    )

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
    let distributions = await distributionsRes.json()
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
