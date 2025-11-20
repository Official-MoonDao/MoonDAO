import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { Project } from '@/lib/project/useProjectData'
import { ProposalPacket } from '@nance/nance-sdk'
import { add, differenceInDays, formatDistanceToNow, fromUnixTime } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import useAccount from '../../lib/nance/useAccountAddress'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import { AddressLink } from './AddressLink'
import RequestingTokensOfProposal from './RequestingTokensOfProposal'
import VotingInfo from './VotingInfo'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
type SignStatus = 'idle' | 'loading' | 'success' | 'error'

export function ProposalInfoSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-x-4 sm:flex-row">
      <>
        <div
          className="hidden h-6 w-6 shrink-0 sm:block animate-pulse dark:bg-gray-700 rounded-full"
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-10 items-center rounded-md animate-pulse dark:bg-gray-700 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 sm:hidden"></p>
      </>
      <div className="min-w-0 flex-auto">
        {/* Title */}
        <p className="h-6 w-15 animate-pulse dark:bg-gray-700 rounded-md"></p>
        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-x-6 text-xs">
          {/* Author */}
          <div className="flex items-center gap-x-1">
            <Image
              src={`https://cdn.stamp.fyi/avatar/undefined`}
              alt=""
              className="h-6 w-6 flex-none rounded-full bg-gray-50"
              width={75}
              height={75}
            />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Author</p>
              <div className="text-center text-black dark:text-white animate-pulse dark:bg-gray-700 rounded-md h-4 w-20"></div>
            </div>
          </div>
          {/* Due / Cycle */}
          <div className="flex items-center gap-x-1">
            <CalendarDaysIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Cycle</p>
              <div className="text-center animate-pulse dark:bg-gray-700 rounded-md h-4 w-6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProposalInfo({
  proposalPacket,
  project,
  votingInfo,
  linkDisabled = false,
  sponsorDisabled = true,
  coauthorsDisabled = true,
  showTitle = true,
  showStatus = true,
  compact = false,
}: {
  proposalPacket: ProposalPacket
  project: Project
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
  linkDisabled?: boolean
  sponsorDisabled?: boolean
  coauthorsDisabled?: boolean
  showTitle?: boolean
  showStatus?: boolean
  compact?: boolean
}) {
  const { isLinked, wallet } = useAccount()

  return (
    <div className="flex min-w-0 flex-col gap-x-4 sm:flex-row">
      <div className="min-w-0 flex-auto">
        {/* Title and Status */}
        <div className="flex items-center">
          <div className="mr-2">
            {showStatus && <ProposalStatus status={proposalPacket.status} />}
          </div>
          {showTitle &&
            (!linkDisabled ? (
              <Link
                href={`/proposal/${project.id}`}
                passHref
                className="text-lg font-semibold text-white hover:text-gray-300 transition-colors"
                style={{ fontFamily: 'Lato' }}
              >
                <span className="absolute inset-x-0 -top-px bottom-0" />
                {`${preTitleDisplay}${project.name}`}
              </Link>
            ) : (
              <span className="text-lg font-semibold text-white" style={{ fontFamily: 'Lato' }}>
                {`${preTitleDisplay}${project.name}`}
              </span>
            ))}
        </div>
        {/* Metadata */}
        <div className="mt-2 flex flex-col md:flex-row items-start md:items-center gap-x-6 text-xs font-RobotoMono">
          {/* Author */}
          {!compact && (
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
          )}
          {/* Due / Cycle */}
          {proposalPacket.status === 'Voting' && votingInfo?.end && (
            <div className="flex items-center gap-x-1">
              <CalendarDaysIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
              <div>
                <p className="text-gray-400 font-RobotoMono">Due</p>
                <div className="text-center text-white font-RobotoMono">
                  {formatDistanceToNow(fromUnixTime(votingInfo.end), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </div>
          )}
          {/* Tokens */}
          <div className="mt-2 md:mt-0">
            {proposalPacket.budget && <RequestingTokensOfProposal budget={proposalPacket.budget} />}
          </div>
        </div>
        {/* Votes */}
        <div className="mt-2">
          <VotingInfo votingInfo={votingInfo} />
        </div>
      </div>
    </div>
  )
}

function ProposalStatus({ status }: { status: number }) {
  const statusConfig = {
    Voting: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
    },
    'Temperature Check': {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      dot: 'bg-orange-500',
    },
    Archived: {
      bg: 'bg-gray-500/10',
      border: 'border-gray-500/30',
      text: 'text-gray-400',
      dot: 'bg-gray-500',
    },
    Approved: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      dot: 'bg-green-500',
    },
    Discussion: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
    },
    Cancelled: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-500',
    },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm`}
      >
        <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
        <span
          className={`text-xs font-medium ${config.text} font-RobotoMono uppercase tracking-wider`}
        >
          {status}
        </span>
      </div>
    </div>
  )
}
