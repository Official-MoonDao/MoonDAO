import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES, CITIZEN_WHITELIST_ADDRESSES } from 'const/config'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import Tier from '@/components/onboarding/Tier'
import ApplyModal from '@/components/onboarding/ApplyModal'

const CitizenTier = () => {
  const { selectedChain } = useContext(ChainContext)
  const sdk = useSDK()
  const address = useAddress()

  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { data: citizenBalance } = useHandleRead(citizenContract, 'balanceOf', [
    address,
  ])

  const handleCitizenClick = async () => {
    const citizenWhitelistContract = await sdk?.getContract(
      CITIZEN_WHITELIST_ADDRESSES[selectedChain.slug]
    )
    const isWhitelisted = await citizenWhitelistContract?.call('isWhitelisted', [
      address,
    ])
    if (isWhitelisted) {
      // Logic for becoming a citizen
      console.log('Citizen whitelist check passed')
    } else {
      setApplyModalEnabled(true)
    }
  }

  return (
    <div id="citizen-tier-container">
      {applyModalEnabled && (
        <ApplyModal
          type="citizen"
          setEnabled={setApplyModalEnabled}
        />
      )}
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
        buttoncta="Become a Citizen"
        onClick={handleCitizenClick}
        hasCitizen={+citizenBalance > 0}
        type="citizen"
      />
    </div>
  )
}

export default CitizenTier