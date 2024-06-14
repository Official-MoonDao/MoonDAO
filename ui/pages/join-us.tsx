import React from 'react'
import PageEnder from '../components/layout/PageEnder'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import MailingList from '../components/layout/MailingList'
import Frame from '../components/layout/Frame'

const JoinUs: React.FC = () => {
  const title = '🚀 Get the latest news and updates from MoonDAO'
  const description = 'Sign up for the MoonDAO newsletter to learn more about how you can participate.'
  const image = '/assets/dp-og.jpg'

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Let's go to space together!"
            sub-header="Follow @OfficialMoonDAO"
            headerSize="max(20px, 3vmax)"
            description={
              <>
                <MailingList />
              </>
            }
            callout={
              <>
                <PageEnder mode='compact'/>
              </>
            }
          >
            <Frame backgroundColor='#090D21'>
              <h1 className="pb-5 header font-GoodTimes">
                MoonDAO makes HISTORY!
              </h1>
              <p className="pb-5">
                We were the first DAO to send someone to space! Join 12,000+ subscribers and find out how we can revolutionize
                the space industry together. MoonDAO is an international
                collective of people united by the mission of decentralizing
                access to space research and exploration and making space
                accessible to everyone, not just the rich and well-connected.
              </p>
              <Frame noPadding>
                <img src="../assets/dp-og.jpg"></img>
              </Frame>
              <p className="pt-5">
                Launching Coby Cotton of Dude Perfect to space was only the
                beginning! MoonDAO aims to make space accessible to anyone in
                the world, regardless of their financial means, and Coby’s
                monumental flight sets the stage for what DAOs are capable of
                achieving. Find out how to get involved in the Internet's Space
                Program and learn more about some of the exciting stuff we've
                got in the works... MoonDAO’s mission is to create a
                self-sustaining, self-governing colony on the Moon to act as a
                launch point for humanity to explore the cosmos. Yes, we're
                serious -- and the Moon parties are going to be epic.
              </p>
            </Frame>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default JoinUs
