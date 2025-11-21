import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { Project } from '@/lib/project/useProjectData'
import { add, differenceInDays, formatDistanceToNow, fromUnixTime } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import useAccount from '../../lib/nance/useAccountAddress'
import { AddressLink } from './AddressLink'
import RequestingTokensOfProposal from './RequestingTokensOfProposal'
import { STATUS_CONFIG, ProposalStatus } from '@/lib/nance/useProposalStatus'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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
  proposalJSON,
  proposalStatus,
  project,
  linkDisabled = false,
  showTitle = true,
  showStatus = true,
  compact = false,
}: {
  proposalJSON: any
  proposalStatus: ProposalStatus
  project: Project
  linkDisabled?: boolean
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
            {showStatus && <ProposalStatusDisplay status={proposalStatus} />}
          </div>
          {showTitle &&
            (!linkDisabled ? (
              <Link
                href={`/project/${project.id}`}
                passHref
                className="text-lg font-semibold text-white hover:text-gray-300 transition-colors"
                style={{ fontFamily: 'Lato' }}
              >
                <span className="absolute inset-x-0 -top-px bottom-0" />
                {`MDP${project.MDP}: ${project.name}`}
              </Link>
            ) : (
              <span className="text-lg font-semibold text-white" style={{ fontFamily: 'Lato' }}>
                {`MDP${project.MDP}: ${project.name}`}
              </span>
            ))}
        </div>
        {/* Metadata */}
        <div className="mt-2 flex flex-col md:flex-row items-start md:items-center gap-x-6 text-xs font-RobotoMono">
          {/* Author */}
          {!compact && (
            <div className="flex items-center gap-x-1">
              <Image
                src={`https://cdn.stamp.fyi/avatar/${proposalJSON?.authorAddress || ZERO_ADDRESS}`}
                alt=""
                className="h-6 w-6 flex-none rounded-full bg-gray-50"
                width={75}
                height={75}
              />
              <div>
                <p className="text-gray-400 font-RobotoMono">Author</p>
                <div className="text-center text-white font-RobotoMono">
                  <AddressLink address={proposalJSON?.authorAddress} />
                </div>
              </div>
            </div>
          )}
          {/* Tokens */}
          <div className="mt-2 md:mt-0">
            {proposalJSON?.budget && <RequestingTokensOfProposal budget={proposalJSON?.budget} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProposalStatusDisplay({ status }: { status: ProposalStatus }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
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
