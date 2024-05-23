import { CalendarDaysIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { Payout, ProposalPacket, Transfer } from '@nance/nance-sdk'
import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import Link from 'next/link'
import { SnapshotGraphqlProposalVotingInfo } from '../../lib/snapshot'
import { AddressLink } from './AddressLink'
import ProposalStatusIcon from './ProposalStatusIcon'
import VotingInfo from './VotingInfo'

export function ProposalInfoSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-x-4 sm:flex-row">
      <>
        <div
          className="hidden h-6 w-6 shrink-0 sm:block animate-pulse dark:bg-white rounded-full"
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-10 items-center rounded-md animate-pulse dark:bg-white bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 sm:hidden"></p>
      </>
      <div className="min-w-0 flex-auto">
        {/* Title */}
        <p className="h-6 w-15 animate-pulse dark:bg-white"></p>
        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-x-6 text-xs">
          {/* Author */}
          <div className="flex items-center gap-x-1">
            <img
              src={`https://cdn.stamp.fyi/avatar/undefined`}
              alt=""
              className="h-6 w-6 flex-none rounded-full bg-gray-50"
            />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Author</p>
              <div className="text-center text-black dark:text-white animate-pulse dark:bg-white h-4 w-20"></div>
            </div>
          </div>
          {/* Due / Cycle */}
          <div className="flex items-center gap-x-1">
            <CalendarDaysIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Cycle</p>
              <div className="text-center animate-pulse dark:bg-white h-4 w-6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
        <p className="text-base font-semibold">
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
              <p className="text-gray-500 dark:text-gray-400">Author</p>
              <div className="text-center text-black dark:text-white">
                <AddressLink address={proposalPacket.authorAddress} />
              </div>
            </div>
          </div>
          {/* Due / Cycle */}
          <div className="flex items-center gap-x-1">
            <CalendarDaysIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
            {['Voting'].includes(proposalPacket.status) && votingInfo ? (
              <div>
                <p className="text-gray-500 dark:text-gray-400">Due</p>
                <div className="text-center">
                  {formatDistanceToNow(fromUnixTime(votingInfo.end), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 dark:text-gray-400">Cycle</p>
                <div className="text-center">
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
