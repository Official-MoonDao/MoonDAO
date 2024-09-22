import { useAddress } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import CreateCitizen from '@/components/onboarding/CreateCitizen'
import CreateTeam from '@/components/onboarding/CreateTeam'
import Pricing from '@/components/onboarding/Pricing'

export default function Join() {
  const { t } = useTranslation('common')
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  // State to manage selected tier for onboarding flow
  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()

  // If "citizen" is selected, render CreateCitizen component
  if (selectedTier === 'citizen') {
    return (
      <CreateCitizen
        address={address}
        selectedChain={selectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

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
      <Head title={t('joinTitle')} description={t('joinDesc')} />
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
          {/* Pricing component displays both tiers */}
          <Pricing setSelectedTier={setSelectedTier}/>
        </ContentLayout>
      </Container>
    </div>
  )
}
