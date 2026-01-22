import { NanceProvider } from '@nance/nance-hooks'
import { BLOCKED_PROPOSALS } from 'const/whitelist'
import { ProposalPacket, getActionsFromBody, getProposal } from '@nance/nance-sdk'
import { GetServerSideProps } from 'next'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import useProposalJSON from '@/lib/nance/useProposalJSON'
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

function Proposal({ proposalPacket }: { proposalPacket: ProposalPacket }) {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  const proposalJSON = useProposalJSON(proposalPacket.body)
  const description = proposalJSON?.abstract

  if (proposalPacket) {
    proposalPacket = {
      ...proposalPacket,
      actions:
        proposalPacket.actions && proposalPacket.actions.length > 0
          ? proposalPacket.actions
          : getActionsFromBody(proposalPacket.body) || [],
    }
  }

  const fetchVotes =
    proposalPacket?.voteURL !== undefined &&
    (proposalPacket?.status === 'Voting' ||
      proposalPacket?.status === 'Approved' ||
      proposalPacket?.status === 'Cancelled' ||
      proposalPacket?.status === 'Archived')

  const { data: votes, mutate } = useVotesOfProposal(
    proposalPacket?.voteURL,
    1000, // first
    0, // skip
    query.sortBy as 'created' | 'vp', // orderBy
    fetchVotes // shouldFetch
  )

  // Determine the number of grid columns based on the presence of votes
  const gridCols =
    proposalPacket.voteURL && votes ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'

  return (
    <Container>
      <WebsiteHead title={proposalPacket.title} description={description} />
      <ContentLayout
        header={proposalPacket.title}
        mode="compact"
        headerSize="max(20px, 2vw)"
        description={
          <ProposalInfo
            proposalPacket={proposalPacket}
            votingInfo={votes?.proposal}
            linkDisabled
            sponsorDisabled={false}
            coauthorsDisabled={false}
            showTitle={true}
            showStatus={true}
          />
        }
        preFooter={<NoticeFooter darkBackground={true} />}
        mainPadding
        popOverEffect={false}
        isProfile
      >
        <div className="mt-6 md:mt-10 mb-6 md:mb-10 w-full px-4 md:px-0">
          <div className={`grid ${gridCols} gap-4 md:gap-8 w-full max-w-full`}>
            <div className="lg:col-span-2 relative w-full">
              <div className="absolute top-2 right-2 md:right-[20px] z-10">
                <DropDownMenu proposalPacket={proposalPacket} />
              </div>
              <div className="w-full pr-8 md:pr-0">
                <MarkdownWithTOC body={proposalPacket.body || '--- No content ---'} />
              </div>
            </div>

            {proposalPacket.voteURL && votes && votes?.proposal && (
              <div className="mt-0 md:mt-0 bg-dark-cool lg:bg-darkest-cool rounded-[20px] flex flex-col h-fit">
                {/* Show voting results if proposal voting is closed */}
                {votes.proposal?.state === 'closed' ? (
                  <VotingResults
                    votingInfo={votes.proposal}
                    votesData={votes}
                    threshold={votes.proposal.quorum}
                    onRefetch={() => mutate()}
                  />
                ) : (
                  <div className="px-4 md:px-[40px] p-4 md:p-5">
                    <button
                      className="text-base md:text-lg font-semibold leading-6 text-gray-900 dark:text-white w-full text-left"
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
                    <div className="pb-4 md:pb-5">
                      <ProposalVotes votesOfProposal={votes} refetch={() => mutate()} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="lg:col-span-2 rounded-[20px] px-4 md:px-0">
              {proposalPacket.actions && proposalPacket.actions.length > 0 && (
                <div className="mb-4 break-words">
                  <div className="text-xs md:text-sm">
                    {proposalPacket.actions?.map((action, index) => (
                      <ActionLabel action={action} key={index} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}

export default function ProposalPage({ proposalPacket }: { proposalPacket: ProposalPacket }) {
  return (
    <>
      <WebsiteHead title={proposalPacket.title} />
      <NanceProvider apiUrl={NANCE_API_URL}>
        <Proposal proposalPacket={proposalPacket} />
      </NanceProvider>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<{
  proposalPacket: ProposalPacket
}> = async (context) => {
  try {
    const params = context.params
    const uuid = params?.proposal as string
    if (!uuid) throw new Error('Proposal not found')
    if (BLOCKED_PROPOSALS.has(Number(uuid))) return { notFound: true }
    const proposalPacket = await getProposal({ space: NANCE_SPACE_NAME, uuid }, NANCE_API_URL)
    return {
      props: {
        proposalPacket,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      notFound: true,
    }
  }
}
