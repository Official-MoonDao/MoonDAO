import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ProposalsPacket } from '@nance/nance-sdk'
import { formatDistanceStrict } from 'date-fns'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import ProposalInfo from './ProposalInfo'
import { useProposalStatus } from '@/lib/nance/useProposalStatus'
import useProposalJSON from '@/lib/nance/useProposalJSON'

type ProposalProps = {
  project: any
}

export default function Proposal({ project }: ProposalProps) {
  const proposalStatus = useProposalStatus(project)
  const proposalJSON = useProposalJSON(project)
  return (
    <div
      id="proposal-card"
      className="relative flex flex-col h-full justify-between gap-y-4 px-4 py-5 sm:px-6"
    >
      <div className="flex-1">
        <ProposalInfo
          showTitle={true}
          showStatus={false}
          proposalJSON={proposalJSON}
          proposalStatus={proposalStatus}
          project={project}
          compact={true}
        />
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-x-1.5">
            <div className="flex-none rounded-full bg-emerald-500/20 p-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-sm leading-6 text-white font-RobotoMono font-medium">
              {proposalStatus}
            </p>
          </div>
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
