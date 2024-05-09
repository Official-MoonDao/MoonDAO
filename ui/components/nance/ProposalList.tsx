import {
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
  DocumentMagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useProposalsInfinite } from '@nance/nance-hooks'
import { ProposalsPacket } from '@nance/nance-sdk'
import { formatDistanceStrict } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BooleanParam,
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from 'use-query-params'
import { classNames } from '../../lib/utils/tailwind'
import ProposalInfo from './ProposalInfo'

function NoResults() {
  return (
    <div className="text-center">
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
    { space: 'moondao', cycle, keyword, limit },
    router.isReady
  )

  // concat proposal responses
  const firstRes = proposalDataArray?.[0].data
  let proposalsPacket: ProposalsPacket | undefined
  if (firstRes) {
    proposalsPacket = {
      proposalInfo: firstRes.proposalInfo,
      proposals:
        proposalDataArray.map((data) => data?.data.proposals).flat() || [],
      hasMore: proposalDataArray[proposalDataArray.length - 1].data.hasMore,
    }
  }
  const proposals = proposalsPacket?.proposals || []

  if (proposals.length === 0) {
    return <NoResults />
  }

  return (
    <div>
      <ul className="divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        {proposals.map((proposal) => (
          <li
            key={proposal.uuid}
            className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6"
          >
            <ProposalInfo
              proposalPacket={{
                ...proposal,
                proposalInfo: proposalsPacket.proposalInfo,
              }}
            />
            <div className="hidden shrink-0 items-center gap-x-4 sm:flex">
              <div className="flex sm:flex-col sm:items-end">
                <p className="text-sm leading-6 text-gray-900">
                  {proposal.status}
                </p>
                {['Voting', 'Temperature Check'].includes(proposal.status) ? (
                  <div className="mt-1 flex items-center gap-x-1.5">
                    <div className="flex-none rounded-full bg-emerald-500/20 p-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-xs leading-5 text-gray-500">Voting</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-gray-500">
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
      </ul>

      <div className="m-6 flex justify-center">
        <LoadMoreButton
          dataLength={proposals.length}
          fetchMore={() => setSize(size + 1)}
          // 2 pages with 5 limit will have 6 proposals loaded at least
          // so we can safely assume that if the number of proposals loaded
          loading={(size - 1) * limit + 1 > proposals.length}
          hasMore={proposalsPacket?.hasMore}
        />
      </div>
    </div>
  )
}

function LoadMoreButton({
  dataLength,
  fetchMore,
  loading,
  hasMore = true,
}: {
  dataLength: number
  fetchMore: any
  loading: boolean
  hasMore?: boolean
}) {
  return (
    <div className="col-span-4 inline-flex rounded-md">
      <button
        type="button"
        className={classNames(
          'inline-flex items-center gap-x-1.5 rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 disabled:cursor-not-allowed',
          loading ? '' : 'hover:bg-gray-50 focus:z-10'
        )}
        disabled={loading || !hasMore}
        onClick={fetchMore}
      >
        Load more
      </button>
      <div className="-ml-px inline-flex items-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
        {loading ? (
          <ArrowPathIcon
            className="-ml-0.5 h-5 w-5 animate-spin text-gray-400"
            aria-hidden="true"
          />
        ) : (
          dataLength
        )}
      </div>
    </div>
  )
}
