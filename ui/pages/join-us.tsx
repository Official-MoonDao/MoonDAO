import React from 'react'
import FooterSection from '../components/home/FooterSection'
import Body from '../components/layout/Body'
import Content from '../components/layout/Content'
import WebsiteHead from '../components/layout/Head'
import MailingList from '../components/layout/MailingList'
import RoundedFrame from '../components/layout/RoundedFrame'

const JoinUs: React.FC = () => {
  const title = 'Linktree'
  const description = '🚀 Get the latest news and updates from MoonDAO'

  return (
    <>
      <WebsiteHead title={title} description={description} />
      <section className="w-[calc(100vw-20px)]">
        <Body>
          <Content
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
                <FooterSection />
              </>
            }
          >
            <>
              <h1 className="pb-5 header font-GoodTimes">
                We were the first DAO to send someone into space...
              </h1>
              <p className="pb-5">
                Join 12,000+ subscribers and find out how we can revolutionize
                the space industry together. MoonDAO is an international
                collective of people united by the mission of decentralizing
                access to space research and exploration and making space
                accessible to everyone, not just the rich and well-connected.
              </p>
              <RoundedFrame>
                <img src="../assets/dp-og.jpg"></img>
              </RoundedFrame>
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
            </>
          </Content>
        </Body>
      </section>
    </>
  )
}

export default JoinUs
