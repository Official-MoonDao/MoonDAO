import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import Button from '../layout/Button'
import Proposal from '../nance/Proposal'

export default function OpenVotes({ proposals, packet, votingInfoMap }: any) {
  const router = useRouter()

  const [filteredProposals, setFilteredProposals] = useState<any[]>()

  useEffect(() => {
    if (proposals && proposals.length > 0) {
      setFilteredProposals(
        proposals.filter((p: any) => p.status === 'Temperature Check' || p.status === 'Voting')
      )
    }
  }, [proposals])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <h2 className="header font-GoodTimes">Open Votes</h2>
        </div>

        <Button
          variant="gradient"
          borderRadius="rounded-[5vmax] rounded-bl-[10px]"
          className="min-w-[200px] gradient-2"
          onClick={() => router.push('/vote')}
        >
          See More
        </Button>
      </div>
      {filteredProposals && filteredProposals.length > 0 ? (
        <ul
          className="divide-y divide-gray-100 overflow-y-auto max-h-[400px] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl pb-12"
          id="scrollableUl"
        >
          <InfiniteScroll
            dataLength={Math.min(filteredProposals.length, 5)}
            next={() => {}}
            hasMore={packet.hasMore}
            loader={<p className="text-center mt-5  animate-pulse">Loading...</p>}
            scrollableTarget="scrollableUl"
          >
            {filteredProposals?.map((proposal: any) => (
              <Proposal
                key={proposal.uuid}
                proposal={proposal}
                packet={packet}
                votingInfo={votingInfoMap?.[proposal?.voteURL || '']}
              />
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
