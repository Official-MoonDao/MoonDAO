import { usePrivy } from '@privy-io/react-auth'
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
  const { authenticated } = usePrivy()

  const handleCitizenClick = async () => {
    // Let users enter the citizen creation flow without signing in first —
    // wallet sign-in/creation happens later, right before minting. This keeps
    // the click count low and avoids an upfront login wall.
    //
    // If a wallet IS already connected (and the Privy session is live — we
    // only trust the address when `authenticated` so a stale thirdweb address
    // can't linger past logout), make sure it isn't already a citizen before
    // sending them into the flow. Any failure here is non-blocking: we still
    // let them proceed.
    if (authenticated && address) {
      try {
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
        if (citizenBalance > 0) {
          return toast.error('This wallet is already registered as a citizen.')
        }
      } catch (err) {
        console.error('Failed to check existing citizen status:', err)
      }
    }

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
          'Career Advancement: Access jobs, gigs, hackathons, and more, building on-chain credentials to showcase your experience.',
          'Early Project Access: Engage in space projects, earn money, and advance your career.',
        ]}
        buttoncta={compact ? 'Learn More' : 'Become a Citizen'}
        onClick={compact ? () => {} : handleCitizenClick}
        type="citizen"
        compact={compact}
        gateOnAuth={false}
      />
    </div>
  )
}

export default CitizenTier
