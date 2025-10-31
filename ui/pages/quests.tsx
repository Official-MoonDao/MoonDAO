import Head from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Quests from '@/components/xp/Quests'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useContext } from 'react'
import Link from 'next/link'
import CitizenTier from '@/components/onboarding/CitizenTier'
import { useActiveAccount } from 'thirdweb/react'

export default function QuestsPage() {
  const { citizen } = useContext(CitizenContext)
  const account = useActiveAccount()

  const descriptionSection = (
    <div className="pt-2">
      <p className="text-slate-300 text-lg max-w-3xl">
        Complete quests to earn XP and unlock rewards in the Space Acceleration Network. 
        Build your reputation as a contributor to humanity's multiplanetary future.
      </p>
    </div>
  )

  return (
    <section id="quests-container" className="overflow-hidden">
      <Head
        title="Quests"
        description={
          'Complete quests to earn XP and unlock rewards in the Space Acceleration Network. Build your reputation as a contributor to humanity\'s multiplanetary future.'
        }
        image="https://ipfs.io/ipfs/QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T"
      />
      <Container>
        <ContentLayout
          header="Quests"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          {citizen && account?.address ? (
            <div className="mt-6">
              <Quests />
            </div>
          ) : (
            <div className="md:mb-[5vw] 2xl:mb-[2vw]">
              <p className="p-5 md:p-0">
                {
                  '⚠️ You must be a Citizen of the Space Acceleration Network and signed in to access quests. If you are already a Citizen, please sign in.'
                }
              </p>
              <Link href="/citizen" passHref>
                <CitizenTier setSelectedTier={() => {}} compact />
              </Link>
            </div>
          )}
        </ContentLayout>
      </Container>
    </section>
  )
}