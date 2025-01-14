import CompetitorABI from 'const/abis/Competitor.json'
import {
  COMPETITOR_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  DEPRIZE_ID,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { useRouter } from 'next/router'
import { getContract, readContract } from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { DePrize, DePrizeProps } from '../components/nance/DePrize'

export default function DePrizePage({ competitors }: DePrizeProps) {
  const router = useRouter()
  useChainDefault()
  return (
    <DePrize competitors={competitors} refreshRewards={() => router.reload()} />
  )
}

export async function getStaticProps() {
  // TODO enable mainnet
  const chain = sepolia
  const chainSlug = getChainSlug(chain)

  const competitorTableContract = getContract({
    client: serverClient,
    address: COMPETITOR_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: CompetitorABI as any,
  })

  const competitorBoardTableName = await readContract({
    contract: competitorTableContract,
    method: 'getTableName',
  })

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
