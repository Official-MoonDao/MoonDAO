import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import IndexCardGrid from '../components/layout/IndexCardGrid'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

const cardData = [
  {
    header: 'New Worlds 2024',
    link: 'https://moondao.com/proposal/153',
    hovertext: 'See Proposal',
    paragraph: (
      <>
        {` The Earthlight Foundation (“EarthLight”) is asking the MoonDAO community to sponsor the New Worlds conference and Space Cowboy Ball at Space Center Houston (Houston, Texas) on 1-2 November 2024. This $20,000 “Spice” sponsorship level will...`}
      </>
    ),
    inline: true,
  },
]

const CurrentProjects: React.FC = () => {
  const title = 'Current Projects'
  const description = ''
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
            description={<>Here is what MoonDAO is working on in Q4 2024</>}
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
