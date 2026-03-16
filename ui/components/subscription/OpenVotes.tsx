import { useRouter } from 'next/router'
import StandardButton from '../layout/StandardButton'
import Proposal from '../nance/Proposal'

export default function OpenVotes({ proposals }: any) {
  const router = useRouter()

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mb-6">
        <h2 className="font-GoodTimes text-2xl text-white">Open Votes</h2>
        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/projects')}
        >
          See More
        </StandardButton>
      </div>
      {proposals && proposals.length > 0 ? (
        <div
          className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1"
          id="scrollableUl"
        >
          {proposals?.map((proposal: any) => (
            <div
              key={proposal.id}
              className="bg-slate-600/20 rounded-xl border border-slate-500/30 hover:bg-slate-600/30 hover:border-slate-400/40 transition-all duration-200"
            >
              <Proposal project={proposal} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400 text-center py-8">
          No proposals are currently up for vote or pending, check back later.
        </p>
      )}
    </div>
  )
}
