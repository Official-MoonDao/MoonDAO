import { NanceProvider } from '@nance/nance-hooks'
import { useTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import {
  ProposalPacket,
  getActionsFromBody,
  getProposal,
} from '@nance/nance-sdk'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_MDPS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { getContract, readContract } from 'thirdweb'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { Project } from '@/lib/project/useProjectData'
import { useVotesOfProposal } from '@/lib/snapshot'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
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

  const votes = proposalVotes
  const vMOONEYs = useTotalVMOONEYs(proposalVotes.map((pv) => pv.address))
  console.log(proposalVotes.map((pv) => pv.address))
  console.log('vMOONEYs', vMOONEYs)

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
  proposalVotes,
}: {
  proposalPacket: ProposalPacket
  project: Project
  proposal: string
  proposalVotes: any
}) {
  return (
    <>
      <WebsiteHead title={project.title} />
      <NanceProvider apiUrl={NANCE_API_URL}>
        <Proposal
          proposalPacket={proposalPacket}
          project={project}
          proposal={proposal}
          proposalVotes={proposalVotes}
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
    const mdp = params?.mdp as string
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
    const statement = `SELECT * FROM ${projectTableName} WHERE MDP = ${mdp}`

    const projects = await queryTable(chain, statement)
    const project = projects[0]

    if (!project || BLOCKED_MDPS.has(Number(mdp))) {
      return {
        notFound: true,
      }
    }
    const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
    const proposalVotes = (await queryTable(
      chain,
      voteStatement
    )) as DistributionVote[]

    const proposalJson = await fetch(project.proposalIPFS)
    const proposal = await proposalJson.text()
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
