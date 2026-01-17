import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import StandardButton from '../layout/StandardButton'
import Proposal from '../nance/Proposal'

export default function OpenVotes({ proposals }: any) {
  const router = useRouter()

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-5 mb-8">
        <h2 className="font-GoodTimes text-2xl text-white">Open Votes</h2>

        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/projects')}
        >
          See More
        </StandardButton>
      </div>
      {proposals && proposals.length > 0 ? (
        <ul
          className="divide-y divide-slate-700/50 overflow-y-auto max-h-[400px] text-white"
          id="scrollableUl"
        >
          <InfiniteScroll
            dataLength={Math.min(proposals.length, 5)}
            next={() => {}}
            hasMore={false}
            loader={<p className="text-center mt-5  animate-pulse">Loading...</p>}
            scrollableTarget="scrollableUl"
          >
            {proposals?.map((proposal: any) => <Proposal key={proposal.id} project={proposal} />)}
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
