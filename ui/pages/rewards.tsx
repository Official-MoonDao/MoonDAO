import { Arbitrum, ArbitrumSepolia } from '@thirdweb-dev/chains'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { initSDK } from '@/lib/thirdweb/thirdweb'
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
  const chain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : ArbitrumSepolia
  const sdk = initSDK(chain)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug]
  )

  const distributionTableContract = await sdk.getContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )

  const projectBoardTableName = await projectTableContract.call('getTableName')
  const distributionTableName = await distributionTableContract.call(
    'getTableName'
  )

  const currentYear = new Date().getFullYear()
  // TODO don't use last quarter
  const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3) - 2
  const projectStatement = `SELECT * FROM ${projectBoardTableName} WHERE year = ${currentYear} AND quarter = ${currentQuarter}`
  const projectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
  )
  const projects = await projectsRes.json()

  const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${currentYear} AND quarter = ${currentQuarter}`
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
}
