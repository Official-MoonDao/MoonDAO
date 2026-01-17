import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import { useRouter } from 'next/router'
import { useContext, useState, useEffect } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ApplyModal from '@/components/onboarding/ApplyModal'
import CitizenTier from '@/components/onboarding/CitizenTier'
import CreateCitizen from '@/components/onboarding/CreateCitizen'

export default function Join() {
  const { selectedChain } = useContext(ChainContextV5)
  const router = useRouter()

  const [{ freeMint, create }] = useQueryParams({
    freeMint: withDefault(StringParam, undefined),
    create: withDefault(StringParam, undefined),
  })
  // Always initialize to undefined to prevent hydration mismatch
  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen' | undefined>(undefined)
  const [applyModalEnabled, setApplyModalEnabled] = useState(false)

  useChainDefault()

  useEffect(() => {
    if (router.isReady) {
      if (router.query.onrampSuccess === 'true' || create === 'true') {
        setSelectedTier('citizen')
      }
    }
  }, [router.isReady, router.query.onrampSuccess, create])

  if (selectedTier === 'citizen') {
    return (
      <CreateCitizen
        freeMint={freeMint}
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
          'The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond.'
        }
        image="https://ipfs.io/ipfs/QmUG1fcYnnzkhTFwSvMAy1gcFcq99VCk3Eps1L9g6qkt49"
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
              The Space Acceleration Network is an onchain startup society focused on building a
              permanent settlement on the Moon and beyond. Together we can unlock a multiplanetary
              future.
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
          {applyModalEnabled && <ApplyModal type="citizen" setEnabled={setApplyModalEnabled} />}

          {/* Use the CitizenTier component to display citizen tier */}
          <div className="flex flex-col">
            <div className="mb-10 z-50 flex flex-col">
              <CitizenTier setSelectedTier={setSelectedTier} />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
