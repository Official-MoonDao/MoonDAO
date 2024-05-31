import React from 'react'
import FooterSection from '../components/home/FooterSection'
import Body from '../components/layout/Body'
import Content from '../components/layout/Content'
import WebsiteHead from '../components/layout/Head'

const DudePerfect: React.FC = () => {
  const title = 'MoonDAO sent Dude Perfect to SPACE! 🪐'
  const description =
    '🚀 Launching Coby Cotton to space was only the beginning! MoonDAO’s mission is to create a self-sustaining, self-governing colony on the Moon!'
  const image = '/assets/dp-og.jpg'

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <section className="w-[calc(100vw-20px)]">
        <Body fullWidth>
          <Content
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
                <FooterSection />
              </>
            }
          >
            <>
              <img
                className="mb-5 rounded-[5vmax] rounded-tl-[20px]"
                src="../assets/dude-perfect.jpg"
                alt="Dude Perfect"
              />
              <p>
                MoonDAO is an international collective of people united by the
                mission of decentralizing access to space research and
                exploration. Find out how to get involved and learn more about
                some of the exciting stuff we've got in the works...
              </p>
            </>
          </Content>
        </Body>
      </section>
    </>
  )
}

export default DudePerfect
