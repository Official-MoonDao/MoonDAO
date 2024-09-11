import { useAddress } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ApplyModal from '@/components/onboarding/ApplyModal'
import CreateTeam from '@/components/onboarding/CreateTeam'
import TeamTier from '@/components/layout/TeamTier'

export default function TeamJoin() {
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()
  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  // Ensure default chain settings
  useChainDefault()

  // If "team" is selected, render CreateTeam component
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
          {/* Apply Modal for teams */}
          {applyModalEnabled && (
            <ApplyModal type="team" setEnabled={setApplyModalEnabled} />
          )}
          
          {/* Use the TeamTier component to display team tier */}
          <div className="flex flex-col">
            <div className="mb-10 z-50 flex flex-col">
              <TeamTier />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}