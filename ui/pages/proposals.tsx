import { NanceProvider } from '@nance/nance-hooks'
import { PROJECT_TABLE_NAMES, DEFAULT_CHAIN_V5, NEXT_QUARTER_FUNDING_ETH, MAX_BUDGET_ETH } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { StringParam, useQueryParams } from 'next-query-params'
import queryTable from '@/lib/tableland/queryTable'
import React from 'react'
import { NANCE_API_URL } from '../lib/nance/constants'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { Project } from '@/lib/project/useProjectData'
import RewardAsset from '@/components/project/RewardAsset'

export default function ProposalsPage({ project }: { project: Project }) {
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
                    value={NEXT_QUARTER_FUNDING_ETH.toFixed(4)}
                    usdValue={ethPrice * NEXT_QUARTER_FUNDING_ETH}
                  />
                </div>
                <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <RewardAsset
                    name="ETH"
                    value={MAX_BUDGET_ETH.toFixed(4)}
                    usdValue={ethPrice * MAX_BUDGET_ETH}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw] mt-8">
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
                  <p className="text-gray-300 leading-relaxed mb-4">
                    To submit a proposal, you must use our{' '}
                    <Link
                      href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                      className="text-blue-400 hover:text-blue-300 underline transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Doc template
                    </Link>
                    . Make a copy of the template, fill it out, and ensure it&apos;s shared with &quot;Anyone with the link can view&quot;. Then use the{' '}
                    <span className="text-gray-300 font-medium">&quot;Import from Google Docs&quot;</span> button below to import your proposal. For more details, please refer to{' '}
                    <Link
                      href="/project-system-docs"
                      className="text-blue-400 hover:text-blue-300 underline transition-colors"
                    >
                      our documentation
                    </Link>
                    .
                  </p>
                  <Link
                    href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                      <path d="M14 2v6h6"/>
                      <path d="M16 13H8"/>
                      <path d="M16 17H8"/>
                      <path d="M10 9H8"/>
                    </svg>
                    Open Proposal Template
                  </Link>
                </div>
              </div>
              <ProposalEditor project={project} />
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

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const tokenId: any = query?.tokenId
  if (!tokenId) {
    return {
      props: {},
    }
  }
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const statement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE id = ${tokenId}`
  const projects = await queryTable(chain, statement)
  const project = projects[0]
  if (!projects.length) {
    return {
      props: {},
    }
  }
  return {
    props: { project },
  }
}
