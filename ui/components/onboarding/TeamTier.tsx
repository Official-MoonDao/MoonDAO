import WhitelistABI from 'const/abis/Whitelist.json'
import { TEAM_WHITELIST_ADDRESSES } from 'const/config'
import { useContext, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import ApplyModal from '@/components/onboarding/ApplyModal'
import Tier from '@/components/onboarding/Tier'

type TeamTierProps = {
  setSelectedTier: Function
  compact?: boolean
}

const PRICE = 0.0333

const TeamTier = ({ setSelectedTier, compact = false }: TeamTierProps) => {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { data: usdPrice } = useETHPrice(PRICE, 'ETH_TO_USD')

  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  const handleTeamClick = async () => {
    if (chainSlug === 'sepolia') {
      return setSelectedTier('team')
    }

    const teamWhitelistContract = getContract({
      client,
      address: TEAM_WHITELIST_ADDRESSES[chainSlug],
      chain: selectedChain,
      abi: WhitelistABI as any,
    })
    const isWhitelisted = await readContract({
      contract: teamWhitelistContract,
      method: 'isWhitelisted',
      params: [address],
    })
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
        price={PRICE}
        usdPrice={usdPrice}
        label="Create a Team"
        description="Teams are driving innovation and tackling ambitious space challenges together. From non-profits to startups and university teams, every group has something to contribute to our multiplanetary future. We are all a part of Team Space."
        points={[
          'Funding Access: Obtain seed funding from MoonDAO for your bold projects and initiatives.',
          'Professional Network: Hire top talent including full-time roles or posting bounties, and connect with other cutting-edge organizations.',
          'Marketplace Listing: Sell products and services in a dedicated space marketplace, whether payload space or satellite imagery.',
          'Capital Raising Tools: Leverage new tools to raise capital or solicit donations from a global network of space enthusiasts.',
          'Onchain Tools: Utilize advanced and secure onchain tools to manage your organization and interface with smart contracts.',
        ]}
        buttoncta={compact ? 'Learn More' : 'Create a Team'}
        onClick={compact ? () => {} : handleTeamClick}
        type="team"
        compact={compact}
      />
    </div>
  )
}

export default TeamTier
