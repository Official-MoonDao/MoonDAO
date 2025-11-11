import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Tier from '@/components/onboarding/Tier'

type CitizenTierProps = {
  setSelectedTier: Function
  compact?: boolean
}

const PRICE = 0.0111

const CitizenTier = ({
  setSelectedTier,
  compact = false,
}: CitizenTierProps) => {
  const { selectedChain } = useContext(ChainContextV5)
  const { data: usdPrice } = useETHPrice(PRICE, 'ETH_TO_USD')
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address

  const handleCitizenClick = async () => {
    const citizenContract = getContract({
      client,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain: selectedChain,
    })
    const citizenBalance = await readContract({
      contract: citizenContract,
      method: 'balanceOf' as string,
      params: [address],
    })
    //if (citizenBalance > 0) {
    //return toast.error('You have already registered as a citizen.')
    //}
    setSelectedTier('citizen')
  }

  return (
    <div id="citizen-tier-container">
      <Tier
        price={PRICE}
        usdPrice={usdPrice}
        label="Become a Citizen"
        description="Citizens are the trailblazers supporting the creation of off-world settlements. Whether you're already part of a team or seeking to join one, everyone has a crucial role to play in this mission."
        points={[
          'Unique Identity: Create a personalized, AI-generated passport image representing your on-chain identity.',
          'Professional Networking: Connect with top space startups, non-profits, and ambitious teams.',
          'Career Advancement: Access jobs, gigs, hackathons, and more; building on-chain credentials to showcase your experience.',
          'Early Project Access: Engage in space projects, earn money, and advance your career.',
        ]}
        buttoncta={compact ? 'Learn More' : 'Become a Citizen'}
        onClick={compact ? () => {} : handleCitizenClick}
        type="citizen"
        compact={compact}
      />
    </div>
  )
}

export default CitizenTier
