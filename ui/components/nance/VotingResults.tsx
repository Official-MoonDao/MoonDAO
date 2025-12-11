import { CheckCircleIcon, XCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { formatNumberUSStyle } from '@/lib/nance'
import { SnapshotGraphqlProposalVotingInfo, VotesOfProposal } from '@/lib/snapshot'
import ColorBar from './ColorBar'

interface VotingResultsProps {
  voteOutcome: any
  votes?: any[]
  threshold?: number
  onRefetch?: () => void
}

export default function VotingResults({
  voteOutcome,
  votes,
  threshold = 0,
  onRefetch,
}: VotingResultsProps) {
  const totalVotes = 100
  const forVotes = voteOutcome[1] || 0
  const againstVotes = voteOutcome[2] || 0
  const abstainVotes = voteOutcome[3] || 0

  const forPercentage = ((forVotes / totalVotes) * 100).toFixed(1)
  const againstPercentage = ((againstVotes / totalVotes) * 100).toFixed(1)
  const abstainPercentage = ((abstainVotes / totalVotes) * 100).toFixed(1)

  const passed = forVotes > againstVotes
  const quorumMet = threshold === 0 || totalVotes >= threshold // If no quorum set, consider it met

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white font-GoodTimes">Voting Results</h3>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              passed && quorumMet
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {passed && quorumMet ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <XCircleIcon className="w-4 h-4" />
            )}
            {passed && quorumMet ? 'PASSED' : 'FAILED'}
          </div>
        </div>

        {/* Summary Stats - Moved to top */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-white/5 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{votes?.length || 0}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Voters</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {forPercentage}%
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Support</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* For Votes */}
        <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-green-400">For</p>
              <p className="text-sm text-gray-300">{forPercentage}% of votes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">{formatNumberUSStyle(forVotes, true)}</p>
            <p className="text-xs text-gray-400">%</p>
          </div>
        </div>

        {/* Against Votes */}
        <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Against</p>
              <p className="text-sm text-gray-300">{againstPercentage}% of votes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">{formatNumberUSStyle(againstVotes, true)}</p>
            <p className="text-xs text-gray-400">%</p>
          </div>
        </div>

        {/* Abstain Votes (if any) */}
        {abstainVotes > 0 && (
          <div className="flex items-center justify-between p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <div className="flex items-center gap-3">
              <MinusCircleIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-400">Abstain</p>
                <p className="text-sm text-gray-300">{abstainPercentage}% of votes</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{formatNumberUSStyle(abstainVotes, true)}</p>
              <p className="text-xs text-gray-400">%</p>
            </div>
          </div>
        )}

        {/* Visual Results Bar */}
        <div className="mt-6">
          <div className="mb-2">
            <p className="text-sm text-gray-400 font-medium">Distribution</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg">
            <ColorBar
              greenScore={forVotes}
              redScore={againstVotes}
              threshold={threshold}
              noTooltip={false}
              backgroundColor="bg-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
