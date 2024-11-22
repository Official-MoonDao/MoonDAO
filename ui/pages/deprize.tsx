import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import CompetitorABI from 'const/abis/Competitor.json'
import DePrizeDistributionTableABI from 'const/abis/DePrizeDistribution.json'
import {
  COMPETITOR_TABLE_ADDRESSES,
  DEPRIZE_DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { DePrize, DePrizeProps } from '../components/nance/DePrize'

export default function DePrizePage({
  competitors,
  distributions,
}: DePrizeProps) {
  const router = useRouter()
  return (
    <DePrize
      competitors={competitors}
      distributions={distributions}
      refreshRewards={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  // TODO uncomment
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  //const chain = ArbitrumSepolia
  ////const chain = ArbitrumSepolia
  const sdk = initSDK(chain)

  const competitorTableContract = await sdk.getContract(
    COMPETITOR_TABLE_ADDRESSES[chain.slug],
    CompetitorABI
  )

  const distributionTableContract = await sdk.getContract(
    DEPRIZE_DISTRIBUTION_TABLE_ADDRESSES[chain.slug],
    DePrizeDistributionTableABI
  )

  const competitorBoardTableName = await competitorTableContract.call(
    'getTableName'
  )
  //console.log('competitorBoardTableName')
  //console.log(competitorBoardTableName)
  const distributionTableName = await distributionTableContract.call(
    'getTableName'
  )

  // TODO don't hardcode
  const dePrizeId = 1
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3) - 1
  const competitorStatement = `SELECT * FROM ${competitorBoardTableName} WHERE deprize = ${dePrizeId}`
  const competitorsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${competitorStatement}`
  )
  const competitors = await competitorsRes.json()
  console.log('competitors', competitors)

  const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE deprize = ${dePrizeId}`
  const distributionsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${distributionStatement}`
  )
  const distributions = await distributionsRes.json()

  return {
    props: {
      competitors,
      distributions,
    },
    revalidate: 60,
  }
}
