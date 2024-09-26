import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import { TEAM_WHITELIST_ADDRESSES } from 'const/config'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import ApplyModal from '@/components/onboarding/ApplyModal'
import Tier from '@/components/onboarding/Tier'

type TeamTierProps = {
  setSelectedTier: Function
  compact?: boolean
}

const TeamTier = ({ setSelectedTier, compact = false }: TeamTierProps) => {
  const { selectedChain } = useContext(ChainContext)
  const sdk = useSDK()
  const address = useAddress()

  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  const handleTeamClick = async () => {
    const teamWhitelistContract = await sdk?.getContract(
      TEAM_WHITELIST_ADDRESSES[selectedChain.slug]
    )
    const isWhitelisted = await teamWhitelistContract?.call('isWhitelisted', [
      address,
    ])
    if (isWhitelisted) {
      setSelectedTier('team')
    } else {
      setApplyModalEnabled(true)
    }
  }

  return (
    <div id="team-pricing-container">
      {applyModalEnabled && (
        <ApplyModal type="team" setEnabled={setApplyModalEnabled} />
      )}
      <Tier
        price={0.0333}
        label="Create a Team"
        description="Teams are driving innovation and tackling ambitious space challenges together. From non-profits to startups and university teams, every group has something to contribute to our multiplanetary future. Be a part of Team Space."
        points={[
          'Funding Access: Obtain seed funding from MoonDAO for your bold projects and initiatives.',
          'Professional Network: Hire top talent including full-time roles or posting bounties, and connect with other cutting-edge organizations.',
          'Marketplace Listing: Sell products and services in a dedicated space marketplace, whether payload space or satellite imagery.',
          'Capital Raising Tools: Leverage new tools to raise capital or solicit donations from a global network of space enthusiasts.',
          'Onchain Tools: Utilize advanced and secure onchain tools to manage your organization and interface with smart contracts.',
        ]}
        buttoncta={compact ? "Learn More" : "Create a Team"}
        onClick={compact ? ()=>{} :handleTeamClick}
        type="team"
        compact={compact}
      />
    </div>
  )
}

export default TeamTier
