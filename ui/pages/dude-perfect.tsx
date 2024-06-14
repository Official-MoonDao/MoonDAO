import React from 'react'
import PageEnder from '../components/layout/PageEnder'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import Frame from '../components/layout/Frame'
import Image from 'next/image'

const DudePerfect: React.FC = () => {
  const title = 'MoonDAO sent Dude Perfect to SPACE! 🪐'
  const description =
    '🚀 Launching Coby Cotton to space was only the beginning! MoonDAO’s mission is to create a self-sustaining, self-governing colony on the Moon!'
  const image = '/assets/dp-og.jpg'

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <Container fullWidth>
        <ContentLayout popOverEffect mainPadding
          header="Hey Dude Perfect frens, let's go to space together!"
          headerSize="max(20px, 2vw)"
          description={
            <>
              Launching Coby Cotton to space was only the beginning! MoonDAO’s
              mission is to create a self-sustaining, self-governing colony on
              the Moon to act as a launch point for humanity to explore the
              cosmos.
            </>
          }
          callout={
            <>
              <PageEnder />
            </>
          }
        >
          <Frame backgroundColor='#090D21'>
            <Frame noPadding>
              <Image
                className="mb-5 rounded-[5vmax] rounded-tl-[20px]"
                src="/assets/dude-perfect.jpg"
                alt="Dude Perfect"
                width="2048"
                height="1366"
              />
            </Frame>  
            <p>
              MoonDAO is an international collective of people united by the
              mission of decentralizing access to space research and
              exploration. Find out how to get involved and learn more about
              some of the exciting stuff we've got in the works...
            </p>
          </ Frame>
        </ContentLayout>
      </Container>
    </>
  )
}

export default DudePerfect
