import Head from '../../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import SweepstakesHighlights from '@/components/ticket-to-space/SweepstakesHighlights'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Sweepstakes() {
  return (
    <>
      <Head
        title="Ticket to Space"
        image="https://gray-main-toad-36.mypinata.cloud/ipfs/QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq"
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Meet Our Astronauts"
            headerSize="max(20px, 3vw)"
            description="We sent the first crowdraised astronaut to space, selected via onchain voting, and a second everyday person chosen randomly via onchain sweepstakes. Discover the brave astronauts who represent MoonDAO's mission to space and learn about their journeys as they pioneer humanity's path to the stars."
            preFooter={
              <NoticeFooter
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Join the Mission"
                defaultDescription="Be part of the Space Acceleration Network and play a role in establishing a permanent human presence on the Moon and beyond."
                defaultButtonText="Learn More"
                defaultButtonLink="/join"
                imageWidth={200}
                imageHeight={200}
              />
            }
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <SweepstakesHighlights />
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
