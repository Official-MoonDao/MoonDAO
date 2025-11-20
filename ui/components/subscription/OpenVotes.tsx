import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import StandardButton from '../layout/StandardButton'
import Proposal from '../nance/Proposal'

export default function OpenVotes({ proposals }: any) {
  const router = useRouter()

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <h2 className="header font-GoodTimes">Open Votes</h2>
        </div>

        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/vote')}
        >
          See More
        </StandardButton>
      </div>
      {proposals && proposals.length > 0 ? (
        <ul
          className="divide-y divide-gray-100 overflow-y-auto max-h-[400px] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl pb-12"
          id="scrollableUl"
        >
          <InfiniteScroll
            dataLength={Math.min(proposals.length, 5)}
            next={() => {}}
            hasMore={false}
            loader={<p className="text-center mt-5  animate-pulse">Loading...</p>}
            scrollableTarget="scrollableUl"
          >
            {proposals?.map((proposal: any) => (
              <Proposal key={proposal.id} proposal={proposal} />
            ))}
          </InfiniteScroll>
        </ul>
      ) : (
        <div className="mt-4">
          <p className="py-4 px-2">
            {'No proposals are currently up for vote or pending, check back later.'}
          </p>
        </div>
      )}
    </div>
  )
}
