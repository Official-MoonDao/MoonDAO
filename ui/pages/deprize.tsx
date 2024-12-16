import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import CompetitorABI from 'const/abis/Competitor.json'
import {
  COMPETITOR_TABLE_ADDRESSES,
  DEPRIZE_ID,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { DePrize, DePrizeProps } from '../components/nance/DePrize'

export default function DePrizePage({ competitors }: DePrizeProps) {
  const router = useRouter()
  useChainDefault()
  return (
    <DePrize competitors={competitors} refreshRewards={() => router.reload()} />
  )
}

export async function getStaticProps() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)
  const competitorTableContract = await sdk.getContract(
    COMPETITOR_TABLE_ADDRESSES[chain.slug],
    CompetitorABI
  )
  const competitorBoardTableName = await competitorTableContract.call(
    'getTableName'
  )
  const competitorStatement = `SELECT * FROM ${competitorBoardTableName} WHERE deprize = ${DEPRIZE_ID}`
  const competitorsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${competitorStatement}`
  )
  const competitors = await competitorsRes.json()

  return {
    props: {
      competitors,
    },
    revalidate: 60,
  }
}
