import { GetServerSideProps } from 'next'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { ProposalPacket, getActionsFromBody, getProposal } from '@nance/nance-sdk'
import { NanceProvider } from '@nance/nance-hooks'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { useVotesOfProposal } from '@/lib/snapshot'
import ActionLabel from '@/components/nance/ActionLabel'
import DropDownMenu from '@/components/nance/DropdownMenu'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import ProposalInfo from '@/components/nance/ProposalInfo'
import ProposalVotes from '@/components/nance/ProposalVotes'
import WebsiteHead from '@/components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

function Proposal({ proposalPacket }: { proposalPacket: ProposalPacket }) {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  if (proposalPacket) {
    proposalPacket = {
      ...proposalPacket,
      actions:
        proposalPacket.actions.length > 0
          ? proposalPacket.actions
          : getActionsFromBody(proposalPacket.body) || [],
    }
  }

  const fetchVotes =
    proposalPacket?.voteURL !== undefined &&
    (proposalPacket?.status === 'Voting' ||
      proposalPacket?.status === 'Approved' ||
      proposalPacket?.status === 'Cancelled')

  const { data: votes, mutate } = useVotesOfProposal(
    proposalPacket?.voteURL,
    1000, // first
    0, // skip
    query.sortBy as 'created' | 'vp', // orderBy
    fetchVotes // shouldFetch
  )

  // Determine the number of grid columns based on the presence of votes
  const gridCols = proposalPacket.voteURL && votes ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'

  return (
    <Container>
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
            showTitle={false}
            showStatus={true}
          />
        }
        preFooter={<NoticeFooter />}
        mainPadding
        popOverEffect={false}
        isProfile
      >
        <div className="mt-10 mb-10">
          <div className={`grid ${gridCols} gap-8`}>
            <div className="lg:col-span-2">
              <MarkdownWithTOC
                body={proposalPacket.body || '--- No content ---'}
              />
            </div>

            {proposalPacket.voteURL && votes && (
              <div>
                <button
                  className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                  id="votes"
                  onClick={() => {
                    setQuery({ sortBy: query.sortBy === 'time' ? 'vp' : 'time' })
                  }}
                >
                  Votes
                  <span className="ml-2 text-center text-xs text-gray-300">
                    sort by {query.sortBy === 'vp' ? 'voting power' : 'time'}
                  </span>
                </button>
                <ProposalVotes votesOfProposal={votes} refetch={() => mutate()} />
              </div>
            )}

            <div className="lg:col-span-2 rounded-[20px]">
                {proposalPacket.actions && proposalPacket.actions.length > 0 && (
                  <div className="mb-4 break-words">
                  <div className="text-sm">
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

export const getServerSideProps: GetServerSideProps<{ proposalPacket: ProposalPacket }> = async (context) => {
  try {
    const params = context.params
    const uuid = params?.proposal as string
    if (!uuid) throw new Error('Proposal not found')
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
