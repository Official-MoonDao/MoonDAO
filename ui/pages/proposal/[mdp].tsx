import { runQuadraticVoting } from '@/lib/utils/rewards'
import { useTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { ProposalPacket, getActionsFromBody, getProposal } from '@nance/nance-sdk'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_ADDRESSES,
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_MDPS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { getContract, readContract } from 'thirdweb'
import { Project } from '@/lib/project/useProjectData'
import { useVotesOfProposal } from '@/lib/snapshot'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import ProposalVotes from '@/components/nance/ProposalVotes'
import VotingResults from '@/components/nance/VotingResults'
import ProposalState from '@/lib/nance/types'

function Proposal({
  proposalPacket,
  project,
  proposal,
  votes,
  state,
}: {
  proposalPacket: ProposalPacket
  project: Project
  proposal: string
  votes: any[]
  state: ProposalState
}) {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  // FIXME use actions
  if (proposalPacket) {
    proposalPacket = {
      ...proposalPacket,
      actions:
        proposalPacket.actions && proposalPacket.actions.length > 0
          ? proposalPacket.actions
          : getActionsFromBody(proposalPacket.body) || [],
    }
  }

  const voteAddresses = votes.map((pv) => pv.address)
  const { totalVMOONEYs: vMOONEYs } = useTotalVMOONEYs(voteAddresses)
  const addressToQuadraticVotingPower = Object.fromEntries(
    voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
  )
  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)
  const tallyVotes = async () => {
    const res = await fetch(`/api/proposals/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Important: Specify the content type
      },
      body: JSON.stringify({
        mdp: project?.MDP,
      }),
    })
    const resJson = await res.json()
    console.log('resJson', resJson)
  }
  console.log('outcome', outcome)

  // Determine the number of grid columns based on the presence of votes
  const gridCols = votes ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'

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
                      <h3 className="font-GoodTimes pb-2 text-gray-400">Votes</h3>
                      <span className="ml-2 text-center text-xs text-gray-300">
                        sort by {query.sortBy === 'vp' ? 'voting power' : 'time'}
                      </span>
                    </button>
                    <div className="pb-5">
                      <ProposalVotes
                        state={state}
                        project={project}
                        votesOfProposal={{ votes: votes }}
                        refetch={() => mutate()}
                      />
                    </div>
                    <button onClick={tallyVotes}>Tally votes</button>
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
  votes,
  state,
}: {
  proposalPacket: ProposalPacket
  project: Project
  proposal: string
  votes: any
  state: ProposalState
}) {
  return (
    <>
      <WebsiteHead title={project.title} />
      <Proposal
        proposalPacket={proposalPacket}
        project={project}
        proposal={proposal}
        votes={votes}
        state={state}
      />
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
    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
      chain: chain,
    })
    const proposalContract = getContract({
      client: serverClient,
      address: PROPOSALS_ADDRESSES[chainSlug],
      abi: ProposalsABI.abi as any,
      chain: chain,
    })
    const tempCheckApproved = await readContract({
      contract: proposalContract,
      method: 'tempCheckApproved' as string,
      params: [mdp],
    })
    const tempCheckFailed = await readContract({
      contract: proposalContract,
      method: 'tempCheckFailed' as string,
      params: [mdp],
    })
    const state = tempCheckApproved
      ? 'temp-check-passed'
      : tempCheckFailed
      ? 'temp-check-failed'
      : 'temp-check'

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
    const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]

    const proposalResponse = await fetch(project.proposalIPFS)
    const proposalJson = await proposalResponse.json()
    const proposal = proposalJson.body
    return {
      props: {
        proposal,
        project,
        votes,
        state,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      notFound: true,
    }
  }
}
