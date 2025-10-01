import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useProposalUpload, useSpaceInfo } from '@nance/nance-hooks'
import { ProposalPacket } from '@nance/nance-sdk'
import {
  add,
  differenceInDays,
  formatDistanceToNow,
  fromUnixTime,
} from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '../../lib/marketplace/marketplace-utils/toastConfig'
import { NANCE_SPACE_NAME } from '../../lib/nance/constants'
import useAccount from '../../lib/nance/useAccountAddress'
import { useSignProposal } from '../../lib/nance/useSignProposal'
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
  votingInfo,
  linkDisabled = false,
  sponsorDisabled = true,
  coauthorsDisabled = true,
  showTitle = true,
  showStatus = true,
  compact = false,
}: {
  proposalPacket: ProposalPacket
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
  linkDisabled?: boolean
  sponsorDisabled?: boolean
  coauthorsDisabled?: boolean
  showTitle?: boolean
  showStatus?: boolean
  compact?: boolean
}) {
  const { proposalIdPrefix } = proposalPacket?.proposalInfo
  const { proposalInfo, ...proposal } = proposalPacket
  const preTitleDisplay =
    proposalIdPrefix && proposal.proposalId
      ? `${proposalIdPrefix}${proposal.proposalId}: `
      : ''
  const router = useRouter()
  proposal.voteSetup = {
    type: 'weighted', // could make this dynamic in the future
    choices: ['Yes', 'No', 'Abstain'], // could make this dynamic in the future
  }
  const { isLinked, wallet } = useAccount()
  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')

  // Get space info to find next Snapshot Vote
  // We need this to be compliant with the proposal signing format of Snapshot
  const { data: spaceInfoData } = useSpaceInfo({ space: NANCE_SPACE_NAME })
  const spaceInfo = spaceInfoData?.data
  const { nextEvents, currentEvent } = spaceInfo || {}
  let nextSnapshotVote = nextEvents?.find(
    (event) => event.title === 'Snapshot Vote'
  )
  const nextProposalId = spaceInfo?.nextProposalId
  if (currentEvent?.title === 'Temperature Check') {
    const days = differenceInDays(
      new Date(nextEvents?.slice(-1)[0]?.start || ''),
      new Date(currentEvent.start)
    )
    nextSnapshotVote = {
      title: 'Snapshot Vote',
      start: add(new Date(nextSnapshotVote?.start || ''), {
        days,
      }).toISOString(),
      end: add(new Date(nextSnapshotVote?.end || ''), { days }).toISOString(),
    }
  }

  // Proposal upload
  const { signProposalAsync } = useSignProposal(wallet)
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, proposal?.uuid)
  const buttonsDisabled = !wallet?.linked || signingStatus === 'loading'

  async function signAndSendProposal() {
    if (!nextSnapshotVote) return
    setSigningStatus('loading')
    const proposalId = proposal.proposalId || nextProposalId
    const preTitle = `${proposalIdPrefix}${proposalId}: `
    signProposalAsync(proposal, preTitle, nextSnapshotVote)
      .then((res) => {
        const { signature, message, address } = res
        trigger({
          proposal,
          envelope: {
            type: 'SnapshotSubmitProposal',
            address,
            signature,
            message,
          },
        })
          .then((res) => {
            if (res.success) {
              setSigningStatus('success')
              toast.success('Proposal submitted successfully!', {
                style: toastStyle,
              })
              // Next router push
              router.push(`/proposal/${res.data.uuid}`)
            } else {
              setSigningStatus('error')
              toast.error('Error saving draft.', { style: toastStyle })
            }
          })
          .catch((error) => {
            setSigningStatus('error')
            toast.error(`[API] Error submitting proposal:\n${error}`, {
              style: toastStyle,
            })
          })
      })
      .catch((error) => {
        setSigningStatus('idle')
        toast.error(`[Wallet] Error signing proposal:\n${error}`, {
          style: toastStyle,
        })
      })
  }

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
                href={`/proposal/${
                  proposalPacket.proposalId?.toString() || proposalPacket.uuid
                }`}
                passHref
                className="text-lg font-semibold text-white hover:text-gray-300 transition-colors"
                style={{ fontFamily: 'Lato' }}
              >
                <span className="absolute inset-x-0 -top-px bottom-0" />
                {`${preTitleDisplay}${proposalPacket.title}`}
              </Link>
            ) : (
              <span
                className="text-lg font-semibold text-white"
                style={{ fontFamily: 'Lato' }}
              >
                {`${preTitleDisplay}${proposalPacket.title}`}
              </span>
            ))}
        </div>
        {/* Metadata */}
        <div className="mt-2 flex flex-col md:flex-row items-start md:items-center gap-x-6 text-xs font-RobotoMono">
          {/* Author */}
          {!compact && (
            <div className="flex items-center gap-x-1">
              <Image
                src={`https://cdn.stamp.fyi/avatar/${
                  proposalPacket.authorAddress || ZERO_ADDRESS
                }`}
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
            {proposalPacket.actions && (
              <RequestingTokensOfProposal actions={proposalPacket.actions} />
            )}
          </div>
          {/* Delegate this proposal if it doesn't have an author */}
          {!proposalPacket.authorAddress && isLinked && !sponsorDisabled && (
            <button
              type="button"
              className={`px-5 py-3 bg-moon-orange border border-transparent font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40`}
              disabled={buttonsDisabled}
              onClick={() => {
                signAndSendProposal()
              }}
            >
              {signingStatus === 'loading'
                ? 'Sponsor Proposal...'
                : 'Sponsor Proposal'}
            </button>
          )}
        </div>
        {/* Coauthor */}
        {!coauthorsDisabled && proposal.coauthors && (
          <div className="text-xs ml-7 font-RobotoMono">
            <p className="text-gray-400">Sponsor</p>
            {proposal.coauthors.map((coauthor, index) => {
              return (
                <p key={index} className="text-white">
                  <AddressLink address={coauthor} />
                </p>
              )
            })}
          </div>
        )}
        {/* Votes */}
        <div className="mt-2">
          <VotingInfo votingInfo={votingInfo} />
        </div>
      </div>
    </div>
  )
}

function ProposalStatus({ status }: { status: string }) {
  const statusColors = {
    Voting:
      'bg-gradient-to-r from-yellow-300 to-yellow-600 text-yellow-800 text-sm',
    Archived: 'bg-gradient-to-r from-gray-800 to-gray-600 text-white text-sm',
    Approved: 'bg-gradient-to-r from-green-800 to-green-600 text-white text-sm',
    Discussion: 'bg-gradient-to-r from-[#425EEB] to-[#6D3F79] text-white',
    Cancelled: 'bg-gradient-to-r from-red-800 to-red-600 text-white',
  }

  const colorClass =
    statusColors[status as keyof typeof statusColors] ||
    'bg-gray-200 text-gray-800'

  return (
    <div>
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${colorClass} font-GoodTimes inline-block`}
      >
        {status}
      </span>
    </div>
  )
}
