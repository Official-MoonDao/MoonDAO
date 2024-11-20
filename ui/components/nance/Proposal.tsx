import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ProposalsPacket } from '@nance/nance-sdk'
import { formatDistanceStrict } from 'date-fns'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import ProposalInfo from './ProposalInfo'

type ProposalProps = {
  proposal: any
  packet: ProposalsPacket
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
}

export default function Proposal({
  proposal,
  packet,
  votingInfo,
}: ProposalProps) {
  return (
    <li
      id="proposal-list-item"
      key={proposal.uuid}
      className="lg:mr-5 relative flex bg-dark-cool mt-5 rounded-[20px] justify-between gap-x-6 px-4 py-5 border-transparent border-[1px] hover:border-light-cool transition-all duration-150 sm:px-6"
    >
      <ProposalInfo
        showTitle={true}
        showStatus={false}
        proposalPacket={{
          ...proposal,
          proposalInfo: packet.proposalInfo,
        }}
        votingInfo={votingInfo}
      />
      <div className="hidden shrink-0 items-center gap-x-4 sm:flex">
        <div className="flex sm:flex-col sm:items-end">
          <p className="text-sm leading-6 text-gray-900 dark:text-white">
            {proposal.status}
          </p>
          {['Voting', 'Temperature Check'].includes(proposal.status) ? (
            <div className="mt-1 flex items-center gap-x-1.5">
              <div className="flex-none rounded-full bg-emerald-500/20 p-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                Voting
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              <span className="sr-only">Last edited</span>
              <time dateTime={proposal.lastEditedTime}>
                {formatDistanceStrict(
                  new Date(proposal.lastEditedTime || proposal.createdTime),
                  new Date(),
                  { addSuffix: true }
                )}
              </time>
            </p>
          )}
        </div>
        <ChevronRightIcon
          className="h-5 w-5 flex-none text-gray-400"
          aria-hidden="true"
        />
      </div>
    </li>
  )
}
