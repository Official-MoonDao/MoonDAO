import { NanceProvider } from '@nance/nance-hooks'
import { serverClient } from '@/lib/thirdweb/client'
import queryTable from '@/lib/tableland/queryTable'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import {
  PROJECT_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { Project } from '@/lib/project/useProjectData'
import {
  ProposalPacket,
  getActionsFromBody,
  getProposal,
} from '@nance/nance-sdk'
import { getContract, readContract } from 'thirdweb'
import { GetServerSideProps } from 'next'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { useVotesOfProposal } from '@/lib/snapshot'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ActionLabel from '@/components/nance/ActionLabel'
import DropDownMenu from '@/components/nance/DropdownMenu'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import ProposalInfo from '@/components/nance/ProposalInfo'
import ProposalVotes from '@/components/nance/ProposalVotes'
import VotingResults from '@/components/nance/VotingResults'

function Proposal({
  proposalPacket,
  project,
  proposal,
  proposalVotes,
}: {
  proposalPacket: ProposalPacket
  project: Project
  proposal: string
  proposalVotes: any[]
}) {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  if (proposalPacket) {
    proposalPacket = {
      ...proposalPacket,
      actions:
        proposalPacket.actions && proposalPacket.actions.length > 0
          ? proposalPacket.actions
          : getActionsFromBody(proposalPacket.body) || [],
    }
  }

  //const fetchVotes =
  //proposalPacket?.voteURL !== undefined &&
  //(proposalPacket?.status === 'Voting' ||
  //proposalPacket?.status === 'Approved' ||
  //proposalPacket?.status === 'Cancelled' ||
  //proposalPacket?.status === 'Archived')

  //const { data: votes, mutate } = useVotesOfProposal(
  //proposalPacket?.voteURL,
  //1000, // first
  //0, // skip
  //query.sortBy as 'created' | 'vp', // orderBy
  //fetchVotes // shouldFetch
  //)
  const votes = []

  // Determine the number of grid columns based on the presence of votes
  const gridCols = votes
    ? 'grid-cols-1 lg:grid-cols-3'
    : 'grid-cols-1 lg:grid-cols-2'

  return (
    <Container>
      <ContentLayout
        header={project.title}
        mode="compact"
        headerSize="max(20px, 2vw)"
        description={'Proposal'}
        preFooter={<NoticeFooter darkBackground={true} />}
        mainPadding
        popOverEffect={false}
        isProfile
      >
        <div className="mt-10 mb-10">
          <div className={`grid ${gridCols} gap-8`}>
            <div className="lg:col-span-2 relative">
              <div>
                <MarkdownWithTOC body={proposal || '--- No content ---'} />
              </div>
            </div>

            {true && (
              <div className="mt-[-40px] md:mt-0 bg-dark-cool lg:bg-darkest-cool rounded-[20px] flex flex-col h-fit">
                {/* Show voting results if proposal voting is closed */}
                {votes.proposal?.state === 'closed' ? (
                  <VotingResults
                    votingInfo={votes.proposal}
                    votesData={votes}
                    threshold={votes.proposal.quorum}
                    onRefetch={() => mutate()}
                  />
                ) : (
                  <div className="px-[40px] p-5">
                    <button
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                      id="votes"
                      onClick={() => {
                        setQuery({
                          sortBy: query.sortBy === 'time' ? 'vp' : 'time',
                        })
                      }}
                    >
                      <h3 className="font-GoodTimes pb-2 text-gray-400">
                        Votes
                      </h3>
                      <span className="ml-2 text-center text-xs text-gray-300">
                        sort by{' '}
                        {query.sortBy === 'vp' ? 'voting power' : 'time'}
                      </span>
                    </button>
                    <div className="pb-5">
                      <ProposalVotes
                        project={project}
                        votesOfProposal={{ votes: votes }}
                        refetch={() => mutate()}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}

export default function ProposalPage({
  proposalPacket,
  project,
  proposal,
}: {
  proposalPacket: ProposalPacket
  project: Project
  proposal: string
}) {
  return (
    <>
      <WebsiteHead title={project.title} />
      <NanceProvider apiUrl={NANCE_API_URL}>
        <Proposal
          proposalPacket={proposalPacket}
          project={project}
          proposal={proposal}
        />
      </NanceProvider>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<{
  proposalPacket: ProposalPacket
}> = async (context) => {
  try {
    const params = context.params
    const tokenId = params?.tokenId as string
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    //if (!uuid) throw new Error('Proposal not found')
    //const proposalPacket = await getProposal(
    //{ space: NANCE_SPACE_NAME, uuid },
    //NANCE_API_URL
    //)
    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
      chain: chain,
    })

    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName' as string,
      params: [],
    })
    const statement = `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`

    const projects = await queryTable(chain, statement)
    const project = projects[0]

    if (!project || BLOCKED_PROJECTS.has(Number(tokenId))) {
      return {
        notFound: true,
      }
    }
    const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE id = ${tokenId}`
    const proposalVotes = (await queryTable(
      chain,
      voteStatement
    )) as DistributionVote[]

    const proposalJson = await fetch(project.proposalIPFS)
    const proposal = await proposalJson.text()
    console.log('proposal', proposal)
    return {
      props: {
        proposal,
        project,
        proposalVotes,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      notFound: true,
    }
  }
}
