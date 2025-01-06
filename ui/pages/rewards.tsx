import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectABI from 'const/abis/Project.json'
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
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug],
    ProjectABI
  )

  const distributionTableContract = await sdk.getContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug],
    DistributionABI
  )

  const projectBoardTableName = await projectTableContract.call('getTableName')
  const distributionTableName = await distributionTableContract.call(
    'getTableName'
  )
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const year = new Date().getFullYear()

  console.log(quarter, year)

  const projectStatement = `SELECT * FROM ${projectBoardTableName} WHERE year = ${2024} AND quarter = ${4}`
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
}
