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
import TeamTier from '@/components/onboarding/TeamTier'

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
        description={'Create a Team within the Space Acceleration Network to bring your organization onchain.'}
        image="https://ipfs.io/ipfs/QmX7FHDoRhsQ4Ube179qjCnvcVQqwJhVRRASUGLEeqwdh2"
      />
      <Container>
        <ContentLayout
          header="Join the Network"
          headerSize="max(20px, 3vw)"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          description={
            <>
              The Space Acceleration Network is an onchain startup society
              focused on building a permanent settlement on the Moon and beyond.
              Together we can unlock a multiplanetary future.
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
              <TeamTier setSelectedTier={setSelectedTier} />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
