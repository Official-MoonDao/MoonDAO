import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import { TEAM_WHITELIST_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ApplyModal from '@/components/onboarding/ApplyModal'
import CreateTeam from '@/components/onboarding/CreateTeam'
import Tier from '@/components/onboarding/Tier'

export default function TeamJoin() {
  const { selectedChain } = useContext(ChainContext)

  const sdk = useSDK()
  const address = useAddress()

  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()
  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  useChainDefault()

  if (selectedTier === 'team') {
    return (
      <CreateTeam
        address={address}
        selectedChain={selectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title={'Create a Team'}
        description={'Create a Team within the MoonDAO Network.'}
      />
      <Container>
        <ContentLayout
          header="Join MoonDAO"
          headerSize="max(20px, 3vw)"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          description={
            <>
              Be part of the first open-source, interplanetary network state
              dedicated to establishing a permanent human presence on the Moon
              and beyond. Registration is currently invite-only, but you can
              send an email to{' '}
              <Link href="mailto:info@moondao.com">info@moondao.com</Link> if
              you think you'd be a good fit.
            </>
          }
          preFooter={
            <>
              <NoticeFooter
                defaultTitle="Need Help?"
                defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
                defaultButtonText="Submit a Ticket"
                defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              />
            </>
          }
        >
          {applyModalEnabled && (
            <ApplyModal type="team" setEnabled={setApplyModalEnabled} />
          )}
          <div className="flex flex-col">
            <div className="mb-10 z-50 flex flex-col">
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
                buttoncta="Create a Team"
                onClick={async () => {
                  const teamWhitelistContract = await sdk?.getContract(
                    TEAM_WHITELIST_ADDRESSES[selectedChain.slug]
                  )
                  const isWhitelisted = await teamWhitelistContract?.call(
                    'isWhitelisted',
                    [address]
                  )
                  if (isWhitelisted) {
                    setSelectedTier('team')
                  } else {
                    setApplyModalEnabled(true)
                  }
                }}
                type="team"
              />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
