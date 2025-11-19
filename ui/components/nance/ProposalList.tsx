import { DocumentMagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ChevronRightIcon } from '@heroicons/react/24/solid'
import { Project } from '@/lib/project/useProjectData'
import {
  BooleanParam,
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from 'next-query-params'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { SnapshotGraphqlProposalVotingInfo, useVotingInfoOfProposals } from '@/lib/snapshot'
import PaginationButtons from '@/components/layout/PaginationButtons'
import Proposal from './Proposal'
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
      <p className="mt-1 text-sm text-gray-500">Try to search with different keyword.</p>
      <div className="mt-6">
        <Link
          href="#"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          passHref
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
    <div className="font-[roboto] mt-4 lg:mt-8">
      <div className="w-full">
        <div className="p-4 md:p-8 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-[2vmax] shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl items-stretch">
            {[...Array(8).keys()].map((n) => (
              <div
                key={n}
                className="h-full bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-4 sm:p-6"
              >
                <div className="flex flex-col h-full justify-between gap-y-4">
                  <div className="flex-1">
                    <ProposalInfoSkeleton />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col items-start">
                      <div className="dark:bg-gray-7 rounded-md animate-pulse h-4 w-16"></div>
                      <div className="mt-1 animate-pulse h-3 w-20 bg-gray-500"></div>
                    </div>
                    <ChevronRightIcon
                      className="h-5 w-5 flex-none text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProposalList({
  noPagination = false,
  compact = false,
  proposalLimit = 1000,
  proposals = [],
}: {
  noPagination?: boolean
  compact?: boolean
  proposalLimit?: number
  proposals?: any[]
}) {
  console.log('proposals', proposals)
  const router = useRouter()
  const [query, setQuery] = useQueryParams({
    keyword: StringParam,
    limit: withDefault(NumberParam, 10),
    cycle: withDefault(StringParam, 'All'),
    sortBy: withDefault(StringParam, ''),
    sortDesc: withDefault(BooleanParam, true),
    page: withDefault(NumberParam, 1),
  })
  const { keyword, cycle, limit, page } = query

  // Calculate items per page (proposals that fit on screen)
  const itemsPerPage = 8 // Adjust this number based on screen height
  const [maxPage, setMaxPage] = useState(1)
  const [pageIdx, setPageIdx] = useState(page)

  // Update page index when URL changes
  useEffect(() => {
    if (page !== pageIdx) {
      setPageIdx(page)
    }
  }, [page])

  // Handle page changes
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPageIdx(newPage)
      setQuery({ page: newPage })
    },
    [setQuery]
  )

  if (proposals.length === 0) {
    return <NoResults />
  } else {
    return (
      <>
        <div className="rounded-bl-20px overflow-hidden md:pt-5">
          <div className="font-[roboto] w-full">
            <div
              className={`${
                compact
                  ? 'p-2'
                  : 'p-4 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl'
              }`}
            >
              <div
                className={`grid grid-cols-1 gap-6 w-full items-stretch ${
                  compact ? 'grid-cols-1' : 'lg:grid-cols-2'
                }`}
              >
                {proposals.map((proposal) => (
                  <div
                    key={proposal.uuid}
                    className={`h-auto bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <Proposal proposal={proposal} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        {!noPagination && maxPage > 1 && (
          <div className="mt-8">
            <PaginationButtons
              handlePageChange={handlePageChange}
              maxPage={maxPage}
              pageIdx={pageIdx}
              label="Page"
            />
          </div>
        )}
      </>
    )
  }
}
