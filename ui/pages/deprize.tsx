import { Sepolia } from '@thirdweb-dev/chains'
import CompetitorABI from 'const/abis/Competitor.json'
import DePrizeDistributionTableABI from 'const/abis/DePrizeDistribution.json'
import {
  COMPETITOR_TABLE_ADDRESSES,
  DEPRIZE_DISTRIBUTION_TABLE_ADDRESSES,
  DEPRIZE_ID,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
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
  // TODO enable mainnet
  useChainDefault()
  const { selectedChain } = useContext(ChainContext)
  const sdk = initSDK(selectedChain)

  const competitorTableContract = await sdk.getContract(
    COMPETITOR_TABLE_ADDRESSES[selectedChain.slug],
    CompetitorABI
  )

  const distributionTableContract = await sdk.getContract(
    DEPRIZE_DISTRIBUTION_TABLE_ADDRESSES[selectedChain.slug],
    DePrizeDistributionTableABI
  )

  const competitorBoardTableName = await competitorTableContract.call(
    'getTableName'
  )
  const distributionTableName = await distributionTableContract.call(
    'getTableName'
  )

  // TODO don't hardcode
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3) - 1
  const competitorStatement = `SELECT * FROM ${competitorBoardTableName} WHERE deprize = ${DEPRIZE_ID}`
  const competitorsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${competitorStatement}`
  )
  const competitors = await competitorsRes.json()

  const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE deprize = ${DEPRIZE_ID}`
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
