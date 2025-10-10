import { NanceProvider } from '@nance/nance-hooks'
import {
  ProposalPacket,
  getActionsFromBody,
  getProposal,
} from '@nance/nance-sdk'
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

function Proposal({ proposalPacket }: { proposalPacket: ProposalPacket }) {
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
  const gridCols =
    proposalPacket.voteURL && votes
      ? 'grid-cols-1 lg:grid-cols-3'
      : 'grid-cols-1 lg:grid-cols-2'

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
            showTitle={true}
            showStatus={true}
          />
        }
        preFooter={<NoticeFooter darkBackground={true} />}
        mainPadding
        popOverEffect={false}
        isProfile
      >
        <div className="mt-10 mb-10">
          <div className={`grid ${gridCols} gap-8`}>
            <div className="lg:col-span-2 relative">
              <div className="absolute top-2 right-[20px]">
                <DropDownMenu proposalPacket={proposalPacket} />
              </div>
              <div>
                <MarkdownWithTOC
                  body={proposalPacket.body || '--- No content ---'}
                />
              </div>
            </div>

            {proposalPacket.voteURL && votes && (
              <ProposalVotes
                votesOfProposal={votes}
                refetch={() => mutate()}
                showContainer={true}
                title="Votes"
              />
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

export default function ProposalPage({
  proposalPacket,
}: {
  proposalPacket: ProposalPacket
}) {
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
    const proposalPacket = await getProposal(
      { space: NANCE_SPACE_NAME, uuid },
      NANCE_API_URL
    )
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
