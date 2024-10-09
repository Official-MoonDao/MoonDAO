import { NanceProvider } from '@nance/nance-hooks'
import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useChain } from '@thirdweb-dev/react'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { NANCE_API_URL } from '../lib/nance/constants'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import {
  RetroactiveRewards,
  RetroactiveRewardsProps,
} from '../components/nance/RetroactiveRewards'

export default function Rewards({
  projects,
  //distributionTableContract,
  distributions,
}: RetroactiveRewardsProps) {
  const router = useRouter()
  return (
    <NanceProvider apiUrl={NANCE_API_URL}>
      <RetroactiveRewards
        projects={projects}
        distributions={distributions}
        refreshRewards={() => router.reload()}
      />
    </NanceProvider>
  )
}

export async function getStaticProps() {
  // TODO dynamically set chain
  const chain = useChain()
  const sdk = initSDK(chain)
  console.log('chain.slug')
  console.log(chain.slug)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug]
  )

  const distributionTableContract = await sdk.getContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )

  const projectBoardTableName = await projectTableContract.call('getTableName')
  console.log('projectBoardTableName')
  console.log(projectBoardTableName)
  const distributionTableName = await distributionTableContract.call(
    'getTableName'
  )
  console.log('distributionTableName')
  console.log(distributionTableName)

  const now = Math.floor(Date.now() / 1000)
  const currentYear = new Date().getFullYear()
  // TODO don't use last quarter
  const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3) - 2
  //const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3)
  //
  const projectStatement = `SELECT * FROM ${projectBoardTableName} WHERE year = ${currentYear} AND quarter = ${currentQuarter}`
  console.log('projectStatement')
  console.log(projectStatement)
  const allProjectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
  )
  const allProjects = await allProjectsRes.json()

  const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${currentYear} AND quarter = ${currentQuarter}`
  console.log('distributionStatement')
  console.log(distributionStatement)
  const allDistributionsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${distributionStatement}`
  )
  const allDistributions = await allDistributionsRes.json()

  const distributions = allDistributions

  //const validProjects = allProjects.filter(async (project: ProjectType) => {
  //const teamExpiration = await teamContract.call('expiresAt', [
  //project.teamId,
  //])
  //return teamExpiration.toNumber() > now
  //})
  console.log('distributions')
  console.log(distributions)

  return {
    props: {
      projects: allProjects,
      distributions,
    },
    revalidate: 60,
  }
}
