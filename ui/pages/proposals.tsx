import { NanceProvider } from '@nance/nance-hooks'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import RewardAsset from '@/components/project/RewardAsset'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { NANCE_API_URL } from '../lib/nance/constants'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import { NEXT_ETH_BUDGET } from 'const/config'

export default function ProposalsPage() {
  const title = 'Propose Project'

  useChainDefault()
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  return (
    <>
      <WebsiteHead
        title={title}
        description="Submit a proposal to receive financing or special permissions from the MoonDAO community. Get your project funded and bring your space-related ideas to life."
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Propose Project"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                Submit a proposal to receive financing or special permissions from the MoonDAO
                community. Get your project funded and bring your space-related ideas to life.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="bg-black/20 rounded-xl p-4 border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <h1 className="font-GoodTimes text-white/80 text-lg">{`Total Quarter Budget`}</h1>
                <h1 className="font-GoodTimes text-white/80 text-lg">{`Max Project Budget`}</h1>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <RewardAsset
                    name="ETH"
                    value={NEXT_ETH_BUDGET.toFixed(4)}
                    usdValue={ethPrice * NEXT_ETH_BUDGET}
                  />
                </div>
                <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <RewardAsset
                    name="ETH"
                    value={NEXT_ETH_BUDGET.toFixed(4) / 5}
                    usdValue={(ethPrice * NEXT_ETH_BUDGET) / 5}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="mb-8 w-full bg-black/20 rounded-xl p-6 border border-white/10">
                <div
                  id="instructions-container"
                  className="flex items-center justify-center pt-6 mb-6"
                >
                  <div id="step-1" className="flex flex-col items-center w-1/3 h-[150px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                      <Image src="/assets/icon-number-1.svg" alt="Step 1" width={30} height={30} />
                    </div>
                    <p className="text-center text-gray-300 text-sm">
                      Post to{' '}
                      <Link
                        href="https://discord.com/channels/914720248140279868/1027658256706961509"
                        className="text-blue-400 hover:text-blue-300 underline transition-colors"
                        target="_blank"
                        rel="noreferrer"
                      >
                        #ideation
                      </Link>{' '}
                      <br></br> (optional)
                    </p>
                  </div>
                  <div id="step-2" className="flex flex-col items-center w-1/3 h-[150px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                      <Image src="/assets/icon-number-2.svg" alt="Step 2" width={30} height={30} />
                    </div>
                    <p className="text-center text-gray-300 text-sm">
                      Submit your <br></br>proposal below
                    </p>
                  </div>
                  <div id="step-3" className="flex flex-col items-center w-1/3 h-[150px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                      <Image src="/assets/icon-number-3.svg" alt="Step 3" width={30} height={30} />
                    </div>
                    <p className="text-center text-gray-300 text-sm">
                      Present proposal <br></br>at Town Hall
                    </p>
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                  <p className="text-gray-300 leading-relaxed">
                    Submit a proposal to receive financing or special permissions from the MoonDAO
                    community. Please refer to{' '}
                    <Link
                      href="/project-system-docs"
                      className="text-blue-400 hover:text-blue-300 underline transition-colors"
                    >
                      our documentation
                    </Link>{' '}
                    for more details before getting started. We recommend starting your draft with
                    the{' '}
                    <Link
                      href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                      className="text-blue-400 hover:text-blue-300 underline transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google doc template
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <NanceProvider apiUrl={NANCE_API_URL}>
                <ProposalEditor />
              </NanceProvider>
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
