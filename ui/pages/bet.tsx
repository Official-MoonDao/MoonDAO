import { Sepolia } from '@thirdweb-dev/chains'
import CompetitorABI from 'const/abis/Competitor.json'
import DePrizeDistributionTableABI from 'const/abis/DePrizeDistribution.json'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import Market from '@/components/betting/Market'
import { useAddress, useContract } from '@thirdweb-dev/react'

export default function Bet() {
  const userAddress = useAddress()
  return <Market account={userAddress} />
}
