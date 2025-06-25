import { Tab } from '@headlessui/react'
import { NanceProvider } from '@nance/nance-hooks'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import { DEFAULT_CHAIN_V5, PROJECT_TABLE_ADDRESSES } from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { NANCE_API_URL } from '../lib/nance/constants'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter } from '@/lib/utils/dates'
import ContributionEditor from '../components/contribution/ContributionEditor'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import FinalReportEditor from '@/components/nance/FinalReportEditor'

export default function SubmissionPage({
  projectsFromLastQuarter,
}: {
  projectsFromLastQuarter: Project[] | undefined
}) {
  const [{ tag }, setQuery] = useQueryParams({ tag: StringParam })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const title = 'Collaborate with MoonDAO'

  useEffect(() => {
    if (tag === 'report') {
      setSelectedIndex(2)
    } else if (tag === 'contribution') {
      setSelectedIndex(1)
    } else {
      setSelectedIndex(0)
    }
  }, [tag])

  useChainDefault()

  return (
    <>
      <WebsiteHead title={title} description="" />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submissions"
            headerSize="40px"
            description={<div></div>}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <Tab.Group
                selectedIndex={selectedIndex}
                onChange={setSelectedIndex}
              >
                <Tab.List className="flex flex-col md:flex-row rounded-xl justify-start px-5 mt-5 bg-black/20 p-2 border border-white/10">
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-3 px-6 font-GoodTimes leading-5 focus:outline-none transition-all duration-200 flex-1 text-center
                    ${
                      selected
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: undefined }, 'replaceIn')
                    }}
                  >
                    Proposal
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-3 px-6 font-GoodTimes leading-5 focus:outline-none transition-all duration-200 flex-1 text-center
                    ${
                      selected
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: 'contribution' }, 'replaceIn')
                    }}
                  >
                    Contribution
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-3 px-6 font-GoodTimes leading-5 focus:outline-none transition-all duration-200 flex-1 text-center
                    ${
                      selected
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: 'report' }, 'replaceIn')
                    }}
                  >
                    Final Report
                  </Tab>
                </Tab.List>
                <Tab.Panels className="mt-6">
                  <Tab.Panel className="flex flex-col items-start">
                    <div className="mb-8 w-full bg-black/20 rounded-xl p-6 border border-white/10">
                      <div
                        id="instructions-container"
                        className="flex items-center justify-center pt-6 mb-6"
                      >
                        <div
                          id="step-1"
                          className="flex flex-col items-center w-1/3 h-[150px]"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                            <Image
                              src="/assets/icon-number-1.svg"
                              alt="Step 1"
                              width={30}
                              height={30}
                            />
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
                        <div
                          id="step-2"
                          className="flex flex-col items-center w-1/3 h-[150px]"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                            <Image
                              src="/assets/icon-number-2.svg"
                              alt="Step 2"
                              width={30}
                              height={30}
                            />
                          </div>
                          <p className="text-center text-gray-300 text-sm">
                            Submit your <br></br>proposal below
                          </p>
                        </div>
                        <div
                          id="step-3"
                          className="flex flex-col items-center w-1/3 h-[150px]"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                            <Image
                              src="/assets/icon-number-3.svg"
                              alt="Step 3"
                              width={30}
                              height={30}
                            />
                          </div>
                          <p className="text-center text-gray-300 text-sm">
                            Present proposal <br></br>at Town Hall
                          </p>
                        </div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                        <p className="text-gray-300 leading-relaxed">
                          Submit a proposal to receive financing or special
                          permissions from the MoonDAO community. Please refer to{' '}
                          <a
                            href="https://docs.moondao.com/Projects/Project-System"
                            className="text-blue-400 hover:text-blue-300 underline transition-colors"
                            target="_blank"
                            rel="noreferrer"
                          >
                            our documentation
                          </a>{' '}
                          for more details before getting started. We recommend
                          starting your draft with the{' '}
                          <a
                            href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                            className="text-blue-400 hover:text-blue-300 underline transition-colors"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Google doc template
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                    <NanceProvider apiUrl={NANCE_API_URL}>
                      <ProposalEditor />
                    </NanceProvider>
                  </Tab.Panel>
                  <Tab.Panel>
                    <div className="mb-8 flex flex-col items-center bg-black/20 rounded-xl p-6 border border-white/10">
                      <p className="text-gray-300 max-w-[600px]">
                        What have you done to accelerate the impact of MoonDAO's
                        mission? Submit your non-project work and
                        accomplishments, even if not tied directly to MoonDAO,
                        to earn ETH financial rewards and vMOONEY voting power.
                        If it helps advance our mission and build a
                        multiplanetary future, it counts! Please refer to{' '}
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
                  </Tab.Panel>
                  <Tab.Panel>
                    <div className="mb-8 flex flex-col items-center bg-black/20 rounded-xl p-6 border border-white/10">
                      <p className="text-gray-300 max-w-[600px]">
                        {`Submit the final report for your project. For more information on how to fill out the final report, please check the `}
                        <Link
                          className="text-blue-400 hover:text-blue-300 underline"
                          href="https://docs.moondao.com/Projects/Project-System"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Project System
                        </Link>
                        {'. We recommend starting your draft with the '}

                        <Link
                          className="text-blue-400 hover:text-blue-300 underline"
                          href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google doc template
                        </Link>
                        {'.'}
                      </p>
                    </div>
                    <FinalReportEditor
                      projectsFromLastQuarter={projectsFromLastQuarter}
                    />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
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

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  try {
    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: ProjectTableABI as any,
    })
    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName',
    })

    const { quarter, year } = getRelativeQuarter(-1)

    const statement = `SELECT * FROM ${projectTableName} WHERE quarter = ${quarter} AND year = ${year}`
    const projectsFromLastQuarter = await queryTable(chain, statement)

    return {
      props: {
        projectsFromLastQuarter,
      },
      revalidate: 60,
    }
  } catch (error) {
    return {
      props: {
        projectsFromLastQuarter: [],
      },
    }
  }
}
