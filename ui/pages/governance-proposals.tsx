import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
} from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import { gql, GraphQLClient } from 'graphql-request'
import { GetStaticProps } from 'next'
import { useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import {
  PROJECT_PENDING,
  PROJECT_ACTIVE,
  PROJECT_ENDED,
  PROJECT_TEMP_CHECK_FAILED,
  PROJECT_VOTE_FAILED,
} from '@/lib/nance/types'
import { getProposalStatus } from '@/lib/nance/useProposalStatus'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { isFetchableUrl } from '@/lib/utils/links'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import PaginationButtons from '@/components/layout/PaginationButtons'
import StandardButton from '@/components/layout/StandardButton'
import ProposalList from '@/components/nance/ProposalList'
import SnapshotProposalCard, {
  SnapshotProposal,
} from '@/components/nance/SnapshotProposalCard'

type GovernanceProposalsPageProps = {
  pendingProposals: Project[]
  passedProposals: Project[]
  failedProposals: Project[]
  snapshotProposals: SnapshotProposal[]
}

export default function GovernanceProposalsPage({
  pendingProposals,
  passedProposals,
  failedProposals,
  snapshotProposals,
}: GovernanceProposalsPageProps) {
  useChainDefault()

  const SNAPSHOT_PER_PAGE = 8
  const [snapshotPage, setSnapshotPage] = useState(1)
  const snapshotMaxPage = Math.max(
    1,
    Math.ceil(snapshotProposals.length / SNAPSHOT_PER_PAGE)
  )
  const pagedSnapshots = snapshotProposals.slice(
    (snapshotPage - 1) * SNAPSHOT_PER_PAGE,
    snapshotPage * SNAPSHOT_PER_PAGE
  )

  const title = 'Governance Proposals'
  const description =
    'View and vote on non-project governance proposals for MoonDAO — constitutional amendments, policy changes, and other governance decisions.'

  return (
    <>
      <WebsiteHead title={title} description={description} />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Governance Proposals"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed max-w-3xl">
                Non-project governance proposals — constitutional amendments, policy changes, and
                other governance decisions that shape MoonDAO.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-12 max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              {/* Submit CTA */}
              <div className="flex flex-col sm:flex-row gap-4">
                <StandardButton
                  backgroundColor="bg-gradient-to-r from-blue-600 to-purple-600"
                  textColor="text-white"
                  borderRadius="rounded-full"
                  hoverEffect={false}
                  link="/proposals"
                >
                  Submit a Proposal
                </StandardButton>
              </div>

              {/* Pending / Active Proposals */}
              {pendingProposals.length > 0 && (
                <div>
                  <h2 className="text-2xl font-GoodTimes text-white mb-6">
                    Active Proposals
                  </h2>
                  <ProposalList
                    projects={pendingProposals}
                    noPagination
                  />
                </div>
              )}

              {/* Passed Proposals */}
              {passedProposals.length > 0 && (
                <div>
                  <h2 className="text-2xl font-GoodTimes text-white mb-6">
                    Passed Proposals
                  </h2>
                  <ProposalList
                    projects={passedProposals}
                    noPagination
                  />
                </div>
              )}

              {/* Failed Proposals */}
              {failedProposals.length > 0 && (
                <div>
                  <h2 className="text-2xl font-GoodTimes text-white mb-6">
                    Failed Proposals
                  </h2>
                  <ProposalList
                    projects={failedProposals}
                    noPagination
                  />
                </div>
              )}

              {/* Historical Snapshot Proposals */}
              {snapshotProposals.length > 0 && (
                <div>
                  <h2 className="text-2xl font-GoodTimes text-white mb-2">
                    Historical Snapshot Votes
                  </h2>
                  <p className="text-gray-400 text-sm mb-6">
                    All past governance votes from MoonDAO&apos;s Snapshot space (tomoondao.eth).
                  </p>
                  <div className="p-4 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
                      {pagedSnapshots.map((proposal) => (
                        <div
                          key={proposal.id}
                          className="h-auto bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:scale-[1.02]"
                        >
                          <SnapshotProposalCard proposal={proposal} />
                        </div>
                      ))}
                    </div>
                  </div>
                  {snapshotMaxPage > 1 && (
                    <div className="mt-8">
                      <PaginationButtons
                        handlePageChange={setSnapshotPage}
                        maxPage={snapshotMaxPage}
                        pageIdx={snapshotPage}
                        label="Page"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {pendingProposals.length === 0 &&
                passedProposals.length === 0 &&
                failedProposals.length === 0 &&
                snapshotProposals.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-lg mb-6">
                      No governance proposals have been submitted yet.
                    </p>
                    <StandardButton
                      backgroundColor="bg-gradient-to-r from-blue-600 to-purple-600"
                      textColor="text-white"
                      borderRadius="rounded-full"
                      hoverEffect={false}
                      link="/proposals"
                    >
                      Be the First to Submit
                    </StandardButton>
                  </div>
                )}
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

export const getStaticProps: GetStaticProps = async () => {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = (await queryTable(chain, projectStatement)) || []

    const proposalContract = getContract({
      client: serverClient,
      address: PROPOSALS_ADDRESSES[chainSlug],
      abi: ProposalsABI.abi as any,
      chain: chain,
    })

    const { engineBatchRead } = await import('@/lib/thirdweb/engine')

    const approveds = await engineBatchRead<string>(
      PROPOSALS_ADDRESSES[chainSlug],
      'tempCheckApproved',
      projects.map((project: Project) => [project.MDP]),
      ProposalsABI.abi,
      chain.id
    )
    const faileds = await engineBatchRead<string>(
      PROPOSALS_ADDRESSES[chainSlug],
      'tempCheckFailed',
      projects.map((project: Project) => [project.MDP]),
      ProposalsABI.abi,
      chain.id
    )

    const pendingProposals: Project[] = []
    const passedProposals: Project[] = []
    const failedProposals: Project[] = []

    await Promise.all(
      projects.map(async (project: Project, index: number) => {
        if (BLOCKED_PROJECTS.has(project.id) || BLOCKED_MDPS.has(project.MDP)) return

        if (!isFetchableUrl(project.proposalIPFS)) return

        try {
          const proposalResponse = await fetch(project.proposalIPFS)
          const proposalJSON = await proposalResponse.json()

          // Only include non-project proposals
          if (!proposalJSON?.nonProjectProposal) return

          const activeStatus = project.active
          project.tempCheckApproved = approveds[index]

          if (activeStatus === PROJECT_PENDING) {
            pendingProposals.push(project)
          } else if (
            activeStatus === PROJECT_TEMP_CHECK_FAILED ||
            activeStatus === PROJECT_VOTE_FAILED
          ) {
            failedProposals.push(project)
          } else {
            // PROJECT_ACTIVE or PROJECT_ENDED — these passed
            passedProposals.push(project)
          }
        } catch (error) {
          console.error(
            `Error fetching proposal IPFS for project ${project.id}:`,
            error
          )
        }
      })
    )

    return {
      props: {
        pendingProposals: pendingProposals.reverse(),
        passedProposals: passedProposals.reverse(),
        failedProposals: failedProposals.reverse(),
        snapshotProposals: await fetchAllSnapshotProposals(),
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching governance proposals:', error)
    return {
      props: {
        pendingProposals: [],
        passedProposals: [],
        failedProposals: [],
        snapshotProposals: [],
      },
      revalidate: 60,
    }
  }
}

// Fetch all proposals from Snapshot's tomoondao.eth space, paginating through results
async function fetchAllSnapshotProposals(): Promise<SnapshotProposal[]> {
  const snapshotEndpoint = 'https://hub.snapshot.org/graphql'
  const snapshotClient = new GraphQLClient(snapshotEndpoint, {
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_SNAPSHOT_API_KEY || '',
    },
  })

  const query = gql`
    query AllProposals($skip: Int!) {
      proposals(
        first: 1000
        skip: $skip
        where: { space_in: ["tomoondao.eth"] }
        orderBy: "created"
        orderDirection: desc
      ) {
        id
        title
        state
        choices
        scores
        scores_total
        votes
        quorum
        start
        end
        author
      }
    }
  `

  let allProposals: SnapshotProposal[] = []
  let skip = 0
  let hasMore = true

  while (hasMore) {
    try {
      const data = await snapshotClient.request<{
        proposals: SnapshotProposal[]
      }>(query, { skip })

      allProposals = [...allProposals, ...data.proposals]

      if (data.proposals.length < 1000) {
        hasMore = false
      } else {
        skip += 1000
      }
    } catch (error) {
      console.error('Error fetching Snapshot proposals:', error)
      hasMore = false
    }
  }

  return allProposals
}
