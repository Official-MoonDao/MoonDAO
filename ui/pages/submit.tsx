import { Tab } from '@headlessui/react'
import { NanceProvider } from '@nance/nance-hooks'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import { PROJECT_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { NANCE_API_URL } from '../lib/nance/constants'
import { Project } from '@/lib/project/useProjectData'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import ContributionEditor from '../components/contribution/ContributionEditor'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import FinalReportEditor from '@/components/nance/FinalReportEditor'

const tagIndicies: Record<string, number> = {
  report: 2,
  contribution: 1,
  proposal: 0,
}

export default function SubmissionPage({
  projectsWithoutReport,
}: {
  projectsWithoutReport: Project[] | undefined
}) {
  const [{ tag }, setQuery] = useQueryParams({ tag: StringParam })

  // Default to 0 to avoid hydration mismatch
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

  useEffect(() => {
    // Update the query parameter only if it differs from the current tag
    if (selectedIndex === 2 && tag !== 'report') {
      setQuery({ tag: 'report' }, 'replaceIn')
    } else if (selectedIndex === 1 && tag !== 'contribution') {
      setQuery({ tag: 'contribution' }, 'replaceIn')
    } else if (selectedIndex === 0 && tag !== undefined) {
      setQuery({ tag: undefined }, 'replaceIn')
    }
  }, [selectedIndex])

  const headerContent = <div></div>

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
                        permissions from voting MoonDAO members. Please refer to{' '}
                        <a
                          href="https://docs.moondao.com/Projects/Project-System"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          our documentation
                        </a>{' '}
                        for more details before getting started.
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
                        mission? Submit your results for senate review and
                        potential rewards. Please refer to{' '}
                        <a
                          href="https://docs.moondao.com/Projects/Project-System#retroactive-rewards"
                          className="text-blue-400 hover:text-blue-300 underline"
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
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug],
    ProjectTableABI
  )
  const projectTableName = await projectTableContract?.call('getTableName')

  const statement = `SELECT * FROM ${projectTableName} WHERE finalReportIPFS IS ""`
  const projectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${statement}`
  )
  const projects = await projectsRes.json()

  return {
    props: {
      projectsWithoutReport: projects,
    },
    revalidate: 60,
  }
}
