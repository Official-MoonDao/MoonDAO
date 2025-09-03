import Link from 'next/link'
import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'

export default function SubmissionPage() {
  const title = 'Collaborate & Contribute'

  useChainDefault()

  const submissionTypes = [
    {
      title: 'Submit a Project Proposal',
      description: 'Submit a proposal to receive financing or special permissions from the MoonDAO community.',
      href: '/proposals',
      icon: '📝',
      buttonText: 'Create Project'
    },
    {
      title: 'Submit Your Contribution',
      description: 'Document your mission-aligned work and accomplishments to earn ETH rewards and vMOONEY voting power.',
      href: '/contributions',
      icon: '🚀',
      buttonText: 'Submit Contribution'
    }
  ]

  return (
    <>
      <WebsiteHead 
        title={title} 
        description="Share your work, submit proposals, and contribute to MoonDAO's mission to establish a lunar settlement. Choose how you want to contribute to the space program." 
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Collaborate & Contribute"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                Share your work, submit proposals, and contribute to MoonDAO's mission to establish a lunar settlement. Choose how you want to contribute to the space program.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {submissionTypes.map((type, index) => (
                  <div key={index} className="bg-black/20 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-200 hover:transform hover:scale-[1.02] flex flex-col h-full">
                    <div className="text-4xl mb-4 text-center">{type.icon}</div>
                    <h3 className="text-white font-GoodTimes text-lg mb-3 text-center min-h-[3.5rem] flex items-center justify-center">{type.title}</h3>
                    <p className="text-gray-300 text-sm mb-6 text-center leading-relaxed flex-grow">{type.description}</p>
                    <div className="flex justify-center mt-auto">
                      <Link
                        href={type.href}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        {type.buttonText}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/10">
                <h3 className="text-white font-GoodTimes text-lg mb-3">Not Sure Where to Start?</h3>
                <p className="text-gray-300 mb-4">
                  Check out our documentation to learn more about each submission type and find the best fit for your contribution.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/project-system-docs"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Project System Guide
                  </Link>
                  <Link
                    href="https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards"
                    className="text-blue-400 hover:text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Community Rewards Guide
                  </Link>
                </div>
              </div>
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
