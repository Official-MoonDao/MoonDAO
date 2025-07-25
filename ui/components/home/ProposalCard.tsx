import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import Link from 'next/link'
import { useVotesOfProposal } from '@/lib/snapshot'
import Frame from '../layout/Frame'

interface ProposalCardProps {
  proposal: any
  index: number
}

export function ProposalCard({ proposal, index }: ProposalCardProps) {
  const fetchVotes =
    proposal?.voteURL !== undefined &&
    (proposal?.status === 'Voting' ||
      proposal?.status === 'Approved' ||
      proposal?.status === 'Cancelled')

  const { data: votes } = useVotesOfProposal(
    proposal?.voteURL,
    1000, // first
    0, // skip
    'created', // orderBy
    fetchVotes // shouldFetch
  )

  const votingInfo = votes?.proposal

  return (
    <Link href={`/proposal/${proposal.proposalId}`} passHref>
      <Frame
        key={index}
        noPadding
        bottomLeft="10px"
        bottomRight="10px"
        topRight="0px"
        topLeft="0px"
      >
        <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-4 h-full flex flex-col justify-between">
          <h3 className="font-medium text-white mb-2 text-sm">
            {proposal.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            {votingInfo?.end ? (
              <span>
                Deadline:{' '}
                {formatDistanceToNow(fromUnixTime(votingInfo.end), {
                  addSuffix: true,
                })}
              </span>
            ) : (
              <></>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button className="flex-1 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors mr-2">
              {proposal.status}
            </button>
            {proposal.status === 'Voting' && (
              <div className="flex items-center text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                <span className="text-green-300">Live</span>
              </div>
            )}
          </div>
        </div>
      </Frame>
    </Link>
  )
}
