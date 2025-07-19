import ProjectTableABI from 'const/abis/ProjectTable.json'
import { DEFAULT_CHAIN_V5, PROJECT_TABLE_ADDRESSES } from 'const/config'
import Link from 'next/link'
import React from 'react'
import { getContract, readContract } from 'thirdweb'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import FinalReportEditor from '@/components/nance/FinalReportEditor'

export default function FinalReportsPage({
  projectsFromLastQuarter,
}: {
  projectsFromLastQuarter: Project[] | undefined
}) {
  const title = 'Submit Project Report'

  useChainDefault()

  return (
    <>
      <WebsiteHead 
        title={title} 
        description="Submit the final report for your completed project. Document project outcomes, deliverables, and team contributions for transparency and accountability." 
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submit Project Report"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                Submit the final report for your completed project. Document project outcomes, deliverables, and team contributions for transparency and accountability.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="mb-8 flex flex-col items-center bg-black/20 rounded-xl p-6 border border-white/10">
                <p className="text-gray-300 leading-relaxed text-center">
                  Submit the final report for your completed project. Document outcomes, deliverables, and team contributions for transparency and accountability.
                </p>
                <p className="text-gray-300 leading-relaxed text-center mt-4">
                  For more information, check the{' '}
                  <Link
                    className="text-blue-400 hover:text-blue-300 underline"
                    href="https://docs.moondao.com/Projects/Project-System"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Project System
                  </Link>
                  {' '}guide. Start with our{' '}
                  <Link
                    className="text-blue-400 hover:text-blue-300 underline"
                    href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google doc template
                  </Link>
                  .
                </p>
              </div>
              <FinalReportEditor
                projectsFromLastQuarter={projectsFromLastQuarter}
              />
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
