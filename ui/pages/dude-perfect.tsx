import React from 'react'
import PreFooter from '../components/layout/PreFooter'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import Frame from '../components/layout/Frame'
import Image from 'next/image'
import MailingList from '../components/layout/MailingList'
import Link from 'next/link'
import ColorsAndSocials from '../components/layout/Sidebar/ColorsAndSocials'

const DudePerfect: React.FC = () => {
  const title = '🚀 We Sent Dude Perfect to SPACE!'
  const description =
    '🚀 Launching Coby Cotton to space was only the beginning! MoonDAO’s mission is to create a self-sustaining, self-governing colony on the Moon!'
  const image = '/assets/dp-og.jpg'

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <Container fullWidth>
        <ContentLayout popOverEffect mainPadding
          header="Hey Dude Perfect frens, let's go to space together!"
          headerSize="max(20px, 3vmax)"
          description={
            <>
              <p className="pb-5 md:pb-5">
              Launching Coby Cotton to space was only the beginning! MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement. You can be a part of that future...
              </p>
              <MailingList />
            </>
          }
          preFooter={
            <>
              <PreFooter />
            </>
          }
        >
          <Frame backgroundColor='#090D21'>
            <Frame noPadding marginBottom='0px'>
              <Image
                className="mb-5 rounded-[5vmax] rounded-tl-[20px]"
                src="/assets/dude-perfect.jpg"
                alt="Dude Perfect"
                width="2048"
                height="1366"
              />
            </Frame>  
            <p className="pb-10 md:pb-5">
              MoonDAO is an international collective of people united by the mission of decentralizing access to space research and exploration. Be sure to enter your email address to learn how you can get involved and about some of the exciting stuff we've got in the works... Like the launch of our second astronaut!
            </p>
            <p className="pb-10 md:pb-5">Explore <u><Link href="/">MoonDAO.com</Link></u></p>
            <ColorsAndSocials />
          </ Frame>
        </ContentLayout>
      </Container>
    </>
  )
}

export default DudePerfect
