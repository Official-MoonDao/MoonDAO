import InfiniteScroll from 'react-infinite-scroll-component'
import useOpenVoteProposals from '@/lib/nance/useOpenVoteProposals'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingInfoOfProposals,
} from '@/lib/snapshot'
import Proposal from '../nance/Proposal'

export default function OpenVotes() {
  const { proposals: openVoteProposals, packet } = useOpenVoteProposals()

  const snapshotIds = openVoteProposals
    ?.map((p) => p.voteURL)
    .filter((v) => v !== undefined) as string[]
  const { data: votingInfos } = useVotingInfoOfProposals(snapshotIds)
  const votingInfoMap: { [key: string]: SnapshotGraphqlProposalVotingInfo } = {}
  votingInfos?.forEach((info) => (votingInfoMap[info.id] = info))

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex gap-5 opacity-[50%]">
        <p className="header font-GoodTimes">Open Votes</p>
      </div>
      {openVoteProposals && openVoteProposals.length > 0 ? (
        <ul
          className="divide-y divide-gray-100 overflow-y-auto h-[400px] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl"
          id="scrollableUl"
        >
          <InfiniteScroll
            dataLength={5}
            next={() => {}}
            hasMore={packet.hasMore}
            loader={
              <p className="text-center mt-5  animate-pulse">Loading...</p>
            }
            endMessage={
              <p className="text-center my-5 font-GoodTimes">
                <b>Yay! You have seen it all</b>
              </p>
            }
            scrollableTarget="scrollableUl"
          >
            {openVoteProposals?.map((proposal) => (
              <Proposal
                key={proposal.uuid}
                proposal={proposal}
                packet={packet}
                votingInfo={votingInfoMap[proposal.voteURL || '']}
              />
            ))}
          </InfiniteScroll>
        </ul>
      ) : (
        <div className="mt-4">
          <p>{'No proposals are currently up for vote, check back later.'}</p>
        </div>
      )}
    </div>
  )
}
