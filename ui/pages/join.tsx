import useTranslation from 'next-translate/useTranslation'
import { useContext, useState } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import CreateCitizen from '@/components/onboarding/CreateCitizen'
import CreateTeam from '@/components/onboarding/CreateTeam'
import Pricing from '@/components/onboarding/Pricing'

export default function Join() {
  const { t } = useTranslation('common')
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)

  // State to manage selected tier for onboarding flow
  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()

  // If "citizen" is selected, render CreateCitizen component
  if (selectedTier === 'citizen') {
    return (
      <CreateCitizen
        selectedChain={selectedChain}
        setSelectedChain={setSelectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  // If "team" is selected, render CreateTeam component
  if (selectedTier === 'team') {
    return (
      <CreateTeam
        selectedChain={selectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title={t('joinTitle')}
        description={t('joinDesc')}
        image="https://ipfs.io/ipfs/QmbbjvWBUAXPPibj4ZbzzErVaZBSD99r3dbt5CGQMd5Bkh"
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
          {/* Pricing component displays both tiers */}
          <Pricing setSelectedTier={setSelectedTier} />
        </ContentLayout>
      </Container>
    </div>
  )
}
