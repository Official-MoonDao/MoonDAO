import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useAddress } from '@thirdweb-dev/react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ApplyModal from '@/components/onboarding/ApplyModal'
import CreateCitizen from '@/components/onboarding/CreateCitizen'
import CitizenTier from '@/components/layout/CitizenTier' 

export default function Join() {
  const { t } = useTranslation('common')
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()
  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  // Ensures default chain settings
  useChainDefault()

  // Render CreateCitizen component if 'citizen' is selected
  if (selectedTier === 'citizen') {
    return (
      <CreateCitizen
        address={address}
        selectedChain={selectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title={'Become a Citizen'}
        description={
          'Join the first interplanetary network state dedicated to expanding life beyond Earth.'
        }
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
          {/* Apply Modal for citizen */}
          {applyModalEnabled && (
            <ApplyModal type="citizen" setEnabled={setApplyModalEnabled} />
          )}
          
          {/* Use the CitizenTier component to display citizen tier */}
          <div className="flex flex-col">
            <div className="mb-10 z-50 flex flex-col">
              <CitizenTier />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}