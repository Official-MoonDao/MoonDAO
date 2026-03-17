import { NanceProvider } from '@nance/nance-hooks'
import { BLOCKED_PROPOSALS } from 'const/whitelist'
import { ProposalPacket, getActionsFromBody, getProposal } from '@nance/nance-sdk'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { formatNumberUSStyle } from '@/lib/nance'
import { STATUS_CONFIG } from '@/lib/nance/useProposalStatus'
import {
  useVotesOfProposal,
  SnapshotGraphqlProposalVotingInfo,
  VotesOfProposal,
} from '@/lib/snapshot'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { AddressLink, ShortAddressLink } from '@/components/nance/AddressLink'
import ColorBar from '@/components/nance/ColorBar'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function ProposalPacketInfo({ proposalPacket }: { proposalPacket: ProposalPacket }) {
  const { proposalIdPrefix } = proposalPacket?.proposalInfo || {}
  const preTitleDisplay =
    proposalIdPrefix && proposalPacket.proposalId
      ? `${proposalIdPrefix}${proposalPacket.proposalId}: `
      : ''

  const config = STATUS_CONFIG[proposalPacket.status as keyof typeof STATUS_CONFIG] || {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  }

  return (
    <div className="flex min-w-0 flex-col gap-x-4 sm:flex-row">
      <div className="min-w-0 flex-auto">
        <div className="flex items-center">
          <div className="mr-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm`}
              >
                <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                <span
                  className={`text-xs font-medium ${config.text} font-RobotoMono uppercase tracking-wider`}
                >
                  {proposalPacket.status}
                </span>
              </div>
            </div>
          </div>
          <span className="text-lg font-semibold text-white" style={{ fontFamily: 'Lato' }}>
            {`${preTitleDisplay}${proposalPacket.title}`}
          </span>
        </div>
        <div className="mt-2 flex flex-col md:flex-row items-start md:items-center gap-x-6 text-xs font-RobotoMono">
          <div className="flex items-center gap-x-1">
            <Image
              src={`https://cdn.stamp.fyi/avatar/${proposalPacket.authorAddress || ZERO_ADDRESS}`}
              alt=""
              className="h-6 w-6 flex-none rounded-full bg-gray-50"
              width={75}
              height={75}
            />
            <div>
              <p className="text-gray-400 font-RobotoMono">Author</p>
              <div className="text-center text-white font-RobotoMono">
                <AddressLink address={proposalPacket.authorAddress} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SnapshotVotingResults({
  votingInfo,
  votesData,
  threshold,
}: {
  votingInfo: SnapshotGraphqlProposalVotingInfo
  votesData: VotesOfProposal
  threshold: number
}) {
  const choices = votingInfo.choices || []
  const scores = votingInfo.scores || []
  const scoresTotal = votingInfo.scores_total || 0

  const forScore = scores[0] || 0
  const againstScore = scores[1] || 0
  const abstainScore = scores[2] || 0
  const passed = forScore > againstScore
  const quorumMet = threshold === 0 || scoresTotal >= threshold

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white font-GoodTimes">Voting Results</h3>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              passed && quorumMet
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {passed && quorumMet ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <XCircleIcon className="w-4 h-4" />
            )}
            {passed && quorumMet ? 'PASSED' : 'FAILED'}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-white/5 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{votesData.votes?.length || 0}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Voters</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {scoresTotal > 0 ? ((forScore / scoresTotal) * 100).toFixed(1) : '0'}%
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Support</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatNumberUSStyle(scoresTotal, true)}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total VP</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ColorBar greenScore={forScore} redScore={againstScore} threshold={threshold} noTooltip />
      </div>

      <div className="space-y-3">
        {choices.map((choice, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className={i === 0 ? 'text-green-400' : i === 1 ? 'text-red-400' : 'text-gray-400'}>
              {choice}
            </span>
            <span className="text-white">{formatNumberUSStyle(scores[i] || 0, true)} VP</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SnapshotVotesList({
  votesData,
  sortBy,
  onToggleSort,
}: {
  votesData: VotesOfProposal
  sortBy: string
  onToggleSort: () => void
}) {
  return (
    <div className="px-4 md:px-[40px] p-4 md:p-5">
      <button
        className="text-base md:text-lg font-semibold leading-6 text-gray-900 dark:text-white w-full text-left"
        id="votes"
        onClick={onToggleSort}
      >
        <h3 className="font-GoodTimes pb-2 text-gray-400">Votes</h3>
        <span className="ml-2 text-center text-xs text-gray-300">
          sort by {sortBy === 'vp' ? 'voting power' : 'time'}
        </span>
      </button>
      <div className="pb-4 md:pb-5 mt-4 space-y-2">
        {votesData.votes?.map((vote) => (
          <div key={vote.id} className="flex items-center justify-between py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShortAddressLink address={vote.voter} />
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  vote.choiceLabel === 'For'
                    ? 'bg-green-500/20 text-green-400'
                    : vote.choiceLabel === 'Against'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {vote.choiceLabel || 'Unknown'}
              </span>
            </div>
            <span className="text-xs text-gray-400">{formatNumberUSStyle(vote.vp, true)} VP</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Proposal({ proposalPacket }: { proposalPacket: ProposalPacket }) {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  const description = proposalPacket.body
    ? proposalPacket.body.replace(/[#*_\[\]()>`~|]/g, '').substring(0, 160)
    : ''

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
        description={<ProposalPacketInfo proposalPacket={proposalPacket} />}
        preFooter={<NoticeFooter darkBackground={true} />}
        mainPadding
        popOverEffect={false}
        isProfile
      >
        <div className="mt-6 md:mt-10 mb-6 md:mb-10 w-full px-4 md:px-0">
          <div className={`grid ${gridCols} gap-4 md:gap-8 w-full max-w-full`}>
            <div className="lg:col-span-2 relative w-full">
              <div className="w-full pr-8 md:pr-0">
                <MarkdownWithTOC body={proposalPacket.body || '--- No content ---'} />
              </div>
            </div>

            {proposalPacket.voteURL && votes && votes?.proposal && (
              <div className="mt-0 md:mt-0 bg-dark-cool lg:bg-darkest-cool rounded-[20px] flex flex-col h-fit">
                {/* Show voting results if proposal voting is closed */}
                {votes.proposal?.state === 'closed' ? (
                  <SnapshotVotingResults
                    votingInfo={votes.proposal}
                    votesData={votes}
                    threshold={votes.proposal.quorum}
                  />
                ) : (
                  <SnapshotVotesList
                    votesData={votes}
                    sortBy={query.sortBy as string}
                    onToggleSort={() =>
                      setQuery({ sortBy: query.sortBy === 'time' ? 'vp' : 'time' })
                    }
                  />
                )}
              </div>
            )}
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
