import { CheckCircleIcon, XCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { formatNumberUSStyle } from '@/lib/nance'
import { MEMBER_VOTE_SUPER_MAJORITY } from '@/lib/proposals/computeMemberProposalTally'
import ColorBar from './ColorBar'

interface VotingResultsProps {
  // The Abstain-aware tally object produced by
  // `computeMemberProposalTally` in the proposal page's
  // getServerSideProps. Backwards-compat: when an older `Record<choice,
  // pct-of-total>` is passed instead, we infer enough to render a
  // sensible (if less precise) view.
  voteOutcome: any
  votes?: any[]
}

export default function VotingResults({
  voteOutcome,
  votes,
}: VotingResultsProps) {
  // New shape: an explicit MemberVoteTally with For/Against percentages
  // computed against decided VP (Abstain excluded), plus a separate
  // abstain-share-of-turnout metric for informational display.
  // Old shape: a `Record<choice, pct-of-total>` whose keys '1'/'2'/'3'
  // sum to 100. Detect by presence of the explicit `forPctOfDecided`
  // field and fall back to the old normalization otherwise so the
  // existing project-vote callers keep working.
  const isStructuredTally =
    voteOutcome &&
    typeof voteOutcome === 'object' &&
    'forPctOfDecided' in voteOutcome
  const forPercentage = isStructuredTally
    ? Number(voteOutcome.forPctOfDecided ?? 0).toFixed(1)
    : (Number(voteOutcome?.[1] ?? 0)).toFixed(1)
  const againstPercentage = isStructuredTally
    ? Number(voteOutcome.againstPctOfDecided ?? 0).toFixed(1)
    : (Number(voteOutcome?.[2] ?? 0)).toFixed(1)
  const abstainPercentage = isStructuredTally
    ? Number(voteOutcome.abstainShareOfTurnout ?? 0).toFixed(1)
    : (Number(voteOutcome?.[3] ?? 0)).toFixed(1)

  // Pass/fail: prefer the explicit `passed` flag from the structured
  // tally (mirrors the on-chain decision exactly, including the 66.6%
  // supermajority threshold against decided VP). Fall back to a simple
  // -majority test for the legacy shape so we don't break the
  // project-vote callers that pass an older `Record<choice, pct>`.
  const forPctNum = Number(forPercentage) || 0
  const againstPctNum = Number(againstPercentage) || 0
  const passed = isStructuredTally
    ? Boolean(voteOutcome.passed)
    : forPctNum > againstPctNum

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white font-GoodTimes">Voting Results</h3>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              passed
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {passed ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <XCircleIcon className="w-4 h-4" />
            )}
            {passed ? 'PASSED' : 'FAILED'}
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
              <p className="text-sm text-gray-300">
                {isStructuredTally
                  ? `${forPercentage}% of decided VP`
                  : `${forPercentage}% of votes`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">{forPercentage}%</p>
            {isStructuredTally && voteOutcome.forVP != null && (
              <p className="text-xs text-gray-400">
                {formatNumberUSStyle(Number(voteOutcome.forVP), true)} VP
              </p>
            )}
          </div>
        </div>

        {/* Against Votes */}
        <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Against</p>
              <p className="text-sm text-gray-300">
                {isStructuredTally
                  ? `${againstPercentage}% of decided VP`
                  : `${againstPercentage}% of votes`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">{againstPercentage}%</p>
            {isStructuredTally && voteOutcome.againstVP != null && (
              <p className="text-xs text-gray-400">
                {formatNumberUSStyle(Number(voteOutcome.againstVP), true)} VP
              </p>
            )}
          </div>
        </div>

        {/* Abstain Votes — displayed separately from the For/Against
            decision. % is a share of total turnout (For + Against +
            Abstain), since "abstained" only makes sense as a fraction
            of voters who actually showed up. */}
        {((isStructuredTally && Number(voteOutcome.abstainVP) > 0) ||
          (!isStructuredTally && Number(voteOutcome?.[3] ?? 0) > 0)) && (
          <div className="flex items-center justify-between p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <div className="flex items-center gap-3">
              <MinusCircleIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-400">Abstain</p>
                <p className="text-sm text-gray-300">
                  {isStructuredTally
                    ? `${abstainPercentage}% of turnout VP · excluded from threshold`
                    : `${abstainPercentage}% of votes`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{abstainPercentage}%</p>
              {isStructuredTally && voteOutcome.abstainVP != null && (
                <p className="text-xs text-gray-400">
                  {formatNumberUSStyle(Number(voteOutcome.abstainVP), true)} VP
                </p>
              )}
            </div>
          </div>
        )}

        {/* Visual Results Bar — For vs Against share of decided VP.
            Abstain is intentionally absent here since the bar
            visualizes the supermajority decision, not turnout
            composition. */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-gray-400 font-medium">Decision</p>
            {isStructuredTally && (
              <p className="text-[11px] text-gray-500">
                {`pass threshold: ≥${MEMBER_VOTE_SUPER_MAJORITY}% For of decided VP`}
              </p>
            )}
          </div>
          <div className="bg-slate-800 p-3 rounded-lg">
            <ColorBar
              greenScore={forPctNum}
              redScore={againstPctNum}
              threshold={0}
              noTooltip={false}
              backgroundColor="bg-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
