import { CalendarDaysIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { Payout, ProposalPacket, Transfer } from '@nance/nance-sdk'
import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import Link from 'next/link'
import { SnapshotGraphqlProposalVotingInfo } from '../../lib/snapshot'
import { AddressLink } from './AddressLink'
import ProposalStatusIcon from './ProposalStatusIcon'
import VotingInfo from './VotingInfo'

export default function ProposalInfo({
  proposalPacket,
  votingInfo,
  linkDisabled = false,
}: {
  proposalPacket: ProposalPacket
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
  linkDisabled?: boolean
}) {
  const { proposalIdPrefix } = proposalPacket?.proposalInfo || ''
  const preTitleDisplay = proposalIdPrefix
    ? `${proposalIdPrefix}${proposalPacket.proposalId}: `
    : ''
  return (
    <div className="flex min-w-0 flex-col gap-x-4 sm:flex-row">
      <ProposalStatusIcon status={proposalPacket.status} />
      <div className="min-w-0 flex-auto">
        {/* Title */}
        <p className="text-base font-semibold text-gray-900">
          {!linkDisabled ? (
            <Link
              href={`/proposal/${
                proposalPacket.proposalId?.toString() || proposalPacket.uuid
              }`}
              passHref
            >
              <span className="absolute inset-x-0 -top-px bottom-0" />
              {`${preTitleDisplay}${proposalPacket.title}`}
            </Link>
          ) : (
            <span>{`${preTitleDisplay}${proposalPacket.title}`}</span>
          )}
        </p>
        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-x-6 text-xs">
          {/* Author */}
          <div className="flex items-center gap-x-1">
            <img
              src={`https://cdn.stamp.fyi/avatar/${proposalPacket.authorAddress}`}
              alt=""
              className="h-6 w-6 flex-none rounded-full bg-gray-50"
            />
            <div>
              <p className="text-gray-500">Author</p>
              <div className="text-center text-black">
                <AddressLink address={proposalPacket.authorAddress} />
              </div>
            </div>
          </div>
          {/* Due / Cycle */}
          <div className="flex items-center gap-x-1">
            <CalendarDaysIcon className="h-6 w-6 flex-none rounded-full bg-gray-50 text-gray-900" />
            {['Voting'].includes(proposalPacket.status) && votingInfo ? (
              <div>
                <p className="text-gray-500">Due</p>
                <div className="text-center text-black">
                  {formatDistanceToNow(fromUnixTime(votingInfo.end), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Cycle</p>
                <div className="text-center text-black">
                  {proposalPacket.governanceCycle}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2">
          <VotingInfo votingInfo={votingInfo} />
        </div>
      </div>
    </div>
  )
}
