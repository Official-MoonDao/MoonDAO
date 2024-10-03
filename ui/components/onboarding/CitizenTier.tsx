import { useAddress, useContract } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import Tier from '@/components/onboarding/Tier'

type CitizenTierProps = {
  setSelectedTier: Function
  compact?: boolean
}

const CitizenTier = ({
  setSelectedTier,
  compact = false,
}: CitizenTierProps) => {
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { data: citizenBalance } = useHandleRead(citizenContract, 'balanceOf', [
    address,
  ])

  const handleCitizenClick = () => {
    setSelectedTier('citizen')
  }

  return (
    <div id="citizen-tier-container">
      <Tier
        price={0.0111}
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
        hasCitizen={+citizenBalance > 0}
        type="citizen"
        compact={compact}
      />
    </div>
  )
}

export default CitizenTier
