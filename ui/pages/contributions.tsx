import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import ContributionEditor from '../components/contribution/ContributionEditor'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'

export default function ContributionsPage() {
  const title = 'Submit Your Contribution'

  useChainDefault()

  return (
    <>
      <WebsiteHead 
        title={title} 
        description="Submit your mission-aligned work and accomplishments to earn ETH financial rewards and vMOONEY voting power. Document your contributions to MoonDAO's lunar settlement mission." 
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submit Your Contribution"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                Document your mission-aligned work and accomplishments to earn ETH financial rewards and vMOONEY voting power. If it helps advance our mission and build a multiplanetary future, it counts!
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="mb-8 flex flex-col items-center bg-black/20 rounded-xl p-6 border border-white/10">
                <p className="text-gray-300 leading-relaxed text-center">
                  What have you done to accelerate MoonDAO's mission? Submit your work and accomplishments—whether directly tied to MoonDAO or not—to earn ETH rewards and vMOONEY voting power.
                </p>
                <p className="text-gray-300 leading-relaxed text-center mt-4">
                  If it helps advance our multiplanetary future, it counts! Please refer to{' '}
                  <a
                    href="https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards"
                    className="text-blue-400 hover:text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    our documentation
                  </a>{' '}
                  for more details.
                </p>
              </div>
              <ContributionEditor />
            </div>
          </ContentLayout>
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
