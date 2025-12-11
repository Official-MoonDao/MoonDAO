import Image from 'next/image'
import React from 'react'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import MailingList from '../components/layout/MailingList'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import PreFooter from '../components/layout/PreFooter'
import ColorsAndSocials from '../components/layout/Sidebar/ColorsAndSocials'

const DudePerfect: React.FC = () => {
  const title = '🚀 We Sent Dude Perfect to SPACE!'
  const description =
    "🚀 Launching Coby Cotton to space was only the beginning! MoonDAO's mission is to create a self-sustaining, self-governing colony on the Moon!"
  const image = '/assets/dp-og.jpg'
  const keywords = 'MoonDAO Dude Perfect, Dude Perfect, Coby Cotton, Blue Origin, astronaut'

  return (
    <>
      <WebsiteHead
        title={title}
        description={description}
        image={image}
        keywords={keywords}
        robots="index, follow, max-image-preview:large"
      />
      <section className="flex flex-col justify-start px-4 md:px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Hey Dude Perfect frens, let's go to space together!"
            headerSize="max(20px, 3vmax)"
            mode="compact"
            isProfile={true}
            description={
              <>
                <p className="pb-4 md:pb-8 text-base md:text-lg leading-relaxed text-white/90">
                  Launching Coby Cotton to space was only the beginning! MoonDAO is accelerating our
                  multiplanetary future with an open platform to fund, collaborate, and compete on
                  challenges that get us closer to a lunar settlement. You can be a part of that
                  future...
                </p>
                <div className="pt-2">
                  <MailingList />
                </div>
              </>
            }
            preFooter={
              <>
                <PreFooter mode="compact" />
              </>
            }
          >
            <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl mb-6 md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="overflow-hidden rounded-[5vmax] rounded-tl-[20px]">
                <Image
                  className="w-full h-auto shadow-2xl"
                  src="/assets/dude-perfect.jpg"
                  alt="Dude Perfect"
                  width="2048"
                  height="1366"
                  priority
                />
              </div>
              <div className="space-y-4 md:space-y-6 text-base md:text-lg leading-relaxed">
                <p className="text-white/90">
                  MoonDAO is an international collective of people united by the mission of
                  decentralizing access to space research and exploration. Be sure to enter your
                  email address to learn how you can get involved and about some of the exciting
                  stuff we've got in the works... Like the launch of our second astronaut!
                </p>
              </div>
              <div className="mt-6 md:mt-10 pt-6 md:pt-8 border-t border-white/10">
                <ColorsAndSocials />
              </div>
            </div>
          </ContentLayout>
          <div className="mt-8 md:mt-0"></div>
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        </Container>
      </section>
    </>
  )
}

export default DudePerfect
