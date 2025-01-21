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
import { initSDK } from '@/lib/thirdweb/thirdweb'
import ContributionEditor from '../components/contribution/ContributionEditor'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import FinalReportEditor from '@/components/nance/FinalReportEditor'

export default function SubmissionPage({
  projectsWithoutReport,
}: {
  projectsWithoutReport: Project[] | undefined
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
      <section className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submissions"
            headerSize="40px"
            description={<div></div>}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-4 p-5 bg-slide-section rounded-tl-[2vw] rounded-bl-[2vw]">
              <Tab.Group
                selectedIndex={selectedIndex}
                onChange={setSelectedIndex}
              >
                <Tab.List className="flex rounded-xl">
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-2.5 px-5 font-GoodTimes leading-5 focus:outline-none
                    ${
                      selected
                        ? 'bg-gradient-to-r from-[#5757ec] to-[#6b3d79] text-white shadow'
                        : 'text-white/70 hover:text-white'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: undefined }, 'replaceIn')
                    }}
                  >
                    Submit Proposal
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-2.5 font-GoodTimes leading-5 px-5 focus:outline-none
                    ${
                      selected
                        ? 'bg-gradient-to-r from-[#5757ec] to-[#6b3d79] text-white shadow'
                        : 'text-white/70 hover:text-white'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: 'contribution' }, 'replaceIn')
                    }}
                  >
                    Submit Contribution
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `rounded-lg py-2.5 font-GoodTimes leading-5 px-5 focus:outline-none
                    ${
                      selected
                        ? 'bg-gradient-to-r from-[#5757ec] to-[#6b3d79] text-white shadow'
                        : 'text-white/70 hover:text-white'
                    }`
                    }
                    onClick={() => {
                      setQuery({ tag: 'report' }, 'replaceIn')
                    }}
                  >
                    Submit Report
                  </Tab>
                </Tab.List>
                <Tab.Panels className="mt-4">
                  <Tab.Panel>
                    <div className="mb-8 max-w-[600px]">
                      <div
                        id="instructions-container"
                        className="flex flex-col md:flex-row items-center justify-center gap-8 pt-5"
                      >
                        <div
                          id="step-1"
                          className="flex flex-col items-center max-w-[200px]"
                        >
                          <Image
                            src="/assets/icon-number-1.svg"
                            alt="Step 1"
                            width={70}
                            height={70}
                          />
                          <p className="text-center pt-2 pb-5">
                            (optional) <br></br> Post to{' '}
                            <Link
                              href="https://discord.com/channels/914720248140279868/1027658256706961509"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              #ideation
                            </Link>
                          </p>
                        </div>
                        <div
                          id="step-2"
                          className="flex flex-col items-center max-w-[200px]"
                        >
                          <Image
                            src="/assets/icon-number-2.svg"
                            alt="Step 1"
                            width={70}
                            height={70}
                          />
                          <p className="text-center pt-2 pb-5">
                            Submit your <br></br>proposal below
                          </p>
                        </div>
                        <div
                          id="step-3"
                          className="flex flex-col items-center max-w-[200px]"
                        >
                          <Image
                            src="/assets/icon-number-3.svg"
                            alt="Step 1"
                            width={70}
                            height={70}
                          />
                          <p className="text-center pt-2 pb-5">
                            Present Proposal <br></br>at Townhall
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-300">
                        Submit a proposal to receive financing or special
                        permissions from the MoonDAO community. Please refer to{' '}
                        <a
                          href="https://docs.moondao.com/Projects/Project-System"
                          className="text-blue-400 hover:text-blue-300 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          our documentation
                        </a>{' '}
                        for more details before getting started. We recommend
                        starting your draft with the{' '}
                        <a
                          href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                          className="text-blue-400 hover:text-blue-300 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google doc template
                        </a>
                        .
                      </p>
                    </div>
                    <NanceProvider apiUrl={NANCE_API_URL}>
                      <ProposalEditor />
                    </NanceProvider>
                  </Tab.Panel>
                  <Tab.Panel>
                    <div className="mb-8">
                      <p className="text-gray-300">
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
                    <div className="mb-8">
                      <p className="text-gray-300">
                        Submit a final report for your project.
                      </p>
                    </div>
                    <FinalReportEditor
                      projectsWithoutReport={projectsWithoutReport}
                    />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </ContentLayout>
          <NoticeFooter />
        </Container>
      </section>
    </>
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

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

  const statement = `SELECT * FROM ${projectTableName} WHERE finalReportIPFS IS ""`
  const projects = await queryTable(chain, statement)

  return {
    props: {
      projectsWithoutReport: projects,
    },
    revalidate: 60,
  }
}
