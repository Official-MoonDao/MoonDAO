import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import IndexCardGrid from '../components/layout/IndexCardGrid'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

const cardData = [
  {
    header: 'Mooney Distribution',
    link: 'https://moondao.com/proposal/130',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        This proposal aims to create a balance between different interests within 
        the MoonDAO community by outlining a plan for how to allocate the $MOONEY token in our treasury...
      </>
    ),
    inline: true,
  },
  {
    header: '2nd Astronaut Support Q3',
    link: 'https://moondao.com/proposal/145',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        This proposal aims to continue and build upon advances made in Q2 with a support team surrounding Dr. Eiman 
        Jahangir's forthcoming launch as a representative of MoonDAO. This team will perform outreach for publicity 
        and coverage via various media platforms...
      </>
    ),
    inline: true,
  },
  {
    header: 'Citizens & Teams Q3',
    link: 'https://moondao.com/proposal/148',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        This project is a continuation of the work that was done on Citizens and Teams in Q1 and Q2 of 2024. 
        Citizens and Teams are the foundation of the DAO network we're building, coordinated by our governance and incentives...
      </>
    ),
    inline: true,
  },
  {
    header: 'Secpnd Elected Leader of the Executive Branch',
    link: 'https://moondao.com/proposal/149',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        MoonDAO is electing the second leader of the Executive Branch, also known as the "Astronaut" role in our Constitution, 
        defined in section 2.3.1: "Astronauts are trusted members of the DAO that have the responsibility to represent MoonDAO’s 
        mission and values externally and provide leadership to the DAO internally...
      </>
    ),
    inline: true,
  },
  {
    header: 'Analytics & Final Report Metrics',
    link: 'https://moondao.com/proposal/151',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        Enhance the analytics page by incorporating key metrics and insights extracted from the final reports and subgraphs. 
        Ensure that the data is visually engaging, easy to interpret, and provides actionable insights...
      </>
    ),
    inline: true,
  },
  {
    header: 'New Worlds Sponsorship',
    link: 'https://moondao.com/proposal/153',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        The Earthlight Foundation (“EarthLight”) is asking the MoonDAO community to sponsor the New Worlds conference and Space Cowboy Ball
         at Space Center Houston (Houston, Texas) on 1-2 November 2024....
      </>
    ),
    inline: true,
  },
]

const CurrentProjects: React.FC = () => {
  const title = 'Current Projects'
  const description = ""
  const image = '/assets/moondao-og.jpg'

  useChainDefault()

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Current Projects"
            headerSize="max(20px, 3vw)"
            description={
              <>
                Here is what MoonDAO is working on in 2024Q3:
              </>
            }
            preFooter={<NoticeFooter />}
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10 flex justify-center">
              <IndexCardGrid cards={cardData} singleCol={false} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default CurrentProjects
