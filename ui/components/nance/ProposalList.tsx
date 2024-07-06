import {
  DocumentMagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ChevronRightIcon } from '@heroicons/react/24/solid'
import { useProposalsInfinite } from '@nance/nance-hooks'
import { ProposalsPacket, getActionsFromBody } from '@nance/nance-sdk'
import { formatDistanceStrict } from 'date-fns'
import {
  BooleanParam,
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from 'next-query-params'
import Link from 'next/link'
import { useRouter } from 'next/router'
import InfiniteScroll from 'react-infinite-scroll-component'
import { NANCE_SPACE_NAME } from '@/lib/nance/constants'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingInfoOfProposals,
} from '@/lib/snapshot'
import ProposalInfo, { ProposalInfoSkeleton } from './ProposalInfo'

function NoResults() {
  return (
    <div className="text-center mt-3 lg:mt-10">
      <div className="flex justify-center">
        <DocumentMagnifyingGlassIcon className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="mt-2 text-sm font-semibold text-gray-900">
        No proposals satisified your requirement.
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Try to search with different keyword.
      </p>
      <div className="mt-6">
        <Link
          href="#"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <XMarkIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Reset search
        </Link>
      </div>
    </div>
  )
}

function ProposalListSkeleton() {
  return (
    <div className="font-[Lato] mt-4 lg:mt-8">
      <ul className="divide-y divide-gray-100 overflow-y-auto h-[900px] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        {[...Array(10).keys()].map((n) => (
          <li
            key={n}
            className="relative flex inner-container-background justify-between gap-x-6 px-4 py-5 border-transparent border-[1px] hover:border-white transition-all duration-150 sm:px-6"
          >
            <ProposalInfoSkeleton />
            <div className="hidden shrink-0 items-center gap-x-4 sm:flex">
              <div className="flex sm:flex-col sm:items-end">
                <div className="dark:bg-gray-700 rounded-md animate-pulse h-4 w-12"></div>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  <span className="sr-only">Last edited</span>
                  <span className="animate-pulse h-4 w-8 bg-white"></span>
                </p>
              </div>
              <ChevronRightIcon
                className="h-5 w-5 flex-none text-gray-400"
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ProposalList() {
  const router = useRouter()
  const [query] = useQueryParams({
    keyword: StringParam,
    limit: withDefault(NumberParam, 10),
    cycle: withDefault(StringParam, 'All'),
    sortBy: withDefault(StringParam, ''),
    sortDesc: withDefault(BooleanParam, true),
  })
  const { keyword, cycle, limit } = query

  const {
    data: proposalDataArray,
    isLoading: proposalsLoading,
    size,
    setSize,
  } = useProposalsInfinite(
    { space: NANCE_SPACE_NAME, cycle, keyword, limit },
    router.isReady
  )

  // concat proposal responses
  const firstRes = proposalDataArray?.[0].data
  let proposalsPacket: ProposalsPacket | undefined
  if (firstRes) {
    proposalsPacket = {
      proposalInfo: firstRes.proposalInfo,
      proposals:
        proposalDataArray
          .map((data) =>
            data?.data.proposals.map((p) => {
              return {
                ...p,
                actions:
                  p.actions.length > 0
                    ? p.actions
                    : getActionsFromBody(p.body) || [],
              }
            })
          )
          .flat() || [],
      hasMore: proposalDataArray[proposalDataArray.length - 1].data.hasMore,
    }
  }
  const proposals = proposalsPacket?.proposals || []

  const snapshotIds = proposals
    .map((p) => p.voteURL)
    .filter((v) => v !== undefined) as string[]
  const { data: votingInfos } = useVotingInfoOfProposals(snapshotIds)
  const votingInfoMap: { [key: string]: SnapshotGraphqlProposalVotingInfo } = {}
  votingInfos?.forEach((info) => (votingInfoMap[info.id] = info))

  if (!router.isReady || proposalsLoading) {
    return <ProposalListSkeleton />
  }

  if (!proposalsPacket || proposals.length === 0) {
    return <NoResults />
  } else {
    const packet = proposalsPacket
    return (
      <div className="font-[Lato] mt-4 lg:mt-8">
        <ul
          className="divide-y divide-gray-100 overflow-y-auto h-[900px] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl"
          id="scrollableUl"
        >
          <InfiniteScroll
            dataLength={proposals.length} //This is important field to render the next data
            next={() => {
              setSize(size + 1)
            }}
            hasMore={packet.hasMore}
            loader={
              <p className="text-center my-2 animate-pulse">Loading...</p>
            }
            endMessage={
              <p className="text-center my-2">
                <b>Yay! You have seen it all</b>
              </p>
            }
            scrollableTarget="scrollableUl"
          >
            {proposals.map((proposal) => (
              <li
                key={proposal.uuid}
                className="relative flex inner-container-background justify-between gap-x-6 px-4 py-5 border-transparent border-[1px] hover:border-white transition-all duration-150 sm:px-6"
              >
                <ProposalInfo
                  proposalPacket={{
                    ...proposal,
                    proposalInfo: packet.proposalInfo,
                  }}
                  votingInfo={votingInfoMap[proposal.voteURL || '']}
                />
                <div className="hidden shrink-0 items-center gap-x-4 sm:flex">
                  <div className="flex sm:flex-col sm:items-end">
                    <p className="text-sm leading-6 text-gray-900 dark:text-white">
                      {proposal.status}
                    </p>
                    {['Voting', 'Temperature Check'].includes(
                      proposal.status
                    ) ? (
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
                            new Date(
                              proposal.lastEditedTime || proposal.createdTime
                            ),
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
            ))}
          </InfiniteScroll>
        </ul>
      </div>
    )
  }
}
