import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ProposalsPacket } from '@nance/nance-sdk'
import { formatDistanceStrict } from 'date-fns'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import ProposalInfo from './ProposalInfo'

type ProposalProps = {
  proposal: any
  packet: ProposalsPacket
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
  compact?: boolean
}

export default function Proposal({
  proposal,
  packet,
  votingInfo,
  compact = false,
}: ProposalProps) {
  return (
    <div
      id="proposal-card"
      className="relative flex flex-col h-full justify-between gap-y-4 px-4 py-5 sm:px-6"
    >
      <div className="flex-1">
        <ProposalInfo
          showTitle={true}
          showStatus={false}
          proposalPacket={{
            ...proposal,
            proposalInfo: packet.proposalInfo,
          }}
          votingInfo={votingInfo}
          compact={compact}
        />
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex flex-col items-start">
          <p className="mt-1 text-xs leading-5 text-gray-400 font-RobotoMono">
            <span className="sr-only">Last edited</span>
            <time dateTime={proposal.lastEditedTime}>
              {formatDistanceStrict(
                new Date(proposal.lastEditedTime || proposal.createdTime),
                new Date(),
                { addSuffix: true }
              )}
            </time>
          </p>
        </div>
        <ChevronRightIcon
          className="h-5 w-5 flex-none text-gray-400"
          aria-hidden="true"
          data-testid="chevron-right"
        />
      </div>
    </div>
  )
}
