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
import { initSDK } from '@/lib/thirdweb/thirdweb'
import Market from '@/components/betting/Market'
import { useAddress, useContract } from '@thirdweb-dev/react'

export default function Bet() {
  const userAddress = useAddress()
  return <Market account={userAddress} />
}
