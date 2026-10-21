import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { formatNumberUSStyle } from '@/lib/nance'
import type { RankedChoiceTally } from '@/lib/elections/rankedChoice'
import Tooltip from '@/components/layout/Tooltip'

const RCV_EXPLAINER =
  'Instant runoff: each ballot counts for its highest-ranked candidate still in the race. If no one has more than 50% of the voting power still in play, the last-place candidate is eliminated and their ballots move to each voter’s next choice. Each voter’s VP is the square root of their vMOONEY at the moment voting closed.'

export default function RankedChoiceResults({
  outcome,
  voterCount,
}: {
  outcome: RankedChoiceTally
  voterCount: number
}) {
  const { choices, rounds, winnerKey, winnerLabel, noneWon, tied } = outcome
  const labelFor = (key: number | string) =>
    choices.find((c) => c.key === Number(key))?.label ?? `Choice ${key}`
  const finalRound = rounds[rounds.length - 1]
  const finalEntries = finalRound
    ? Object.entries(finalRound.totals)
        .map(([key, vp]) => ({ key: Number(key), vp }))
        .sort((a, b) => b.vp - a.vp)
    : []

  const status = tied
    ? { label: 'TIED', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }
    : winnerKey === null
    ? { label: 'NO WINNER', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
    : noneWon
    ? { label: 'SEAT VACANT', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
    : { label: 'ELECTED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg sm:text-xl font-heading font-semibold text-white">Final Results</h2>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${status.cls}`}
        >
          {tied ? (
            <ExclamationTriangleIcon className="w-4 h-4" />
          ) : winnerKey !== null && !noneWon ? (
            <CheckCircleIcon className="w-4 h-4" />
          ) : (
            <XCircleIcon className="w-4 h-4" />
          )}
          {status.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-white/5 rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{voterCount}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Voters</p>
        </div>
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-white break-words">
            {tied ? 'Tie' : winnerLabel ?? '—'}
          </p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Winner</p>
            <Tooltip text={RCV_EXPLAINER} wrap>
              <span className="text-[10px] leading-none align-super text-gray-400 cursor-help">
                ⓘ
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      {tied && (
        <p className="mb-4 text-sm text-yellow-200/90">
          The runoff ended in an exact tie it cannot break, so the Senate will resolve it.
        </p>
      )}
      {noneWon && (
        <p className="mb-4 text-sm text-gray-300">
          “None of the above” won the runoff, so the seat remains vacant.
        </p>
      )}

      {finalRound && finalRound.continuingVP > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-400 font-medium">
            Final round (round {finalRound.round})
          </p>
          {finalEntries.map(({ key, vp }) => {
            const pct = finalRound.continuingVP > 0 ? (vp / finalRound.continuingVP) * 100 : 0
            const isWinner = key === winnerKey
            return (
              <div
                key={key}
                className={`p-3 rounded-lg border ${
                  isWinner ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className={`font-medium ${isWinner ? 'text-green-300' : 'text-white'}`}>
                    {labelFor(key)}
                  </p>
                  <p className="text-sm text-white font-semibold whitespace-nowrap">
                    {pct.toFixed(1)}%{' '}
                    <span className="text-xs text-gray-400 font-normal">
                      {formatNumberUSStyle(vp, true)} VP
                    </span>
                  </p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${isWinner ? 'bg-green-500/70' : 'bg-blue-400/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rounds.length > 1 && (
        <div>
          <p className="text-sm text-gray-400 font-medium mb-2">Round by round</p>
          <ol className="space-y-2">
            {rounds.map((r) => (
              <li key={r.round} className="text-xs text-gray-300 bg-white/5 rounded-lg p-3">
                <p className="font-semibold text-white mb-1">Round {r.round}</p>
                <p>
                  {Object.entries(r.totals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, vp]) => `${labelFor(key)} ${formatNumberUSStyle(vp, true)}`)
                    .join(' · ')}
                </p>
                {r.exhaustedVP > 0 && (
                  <p className="text-gray-500 mt-1">
                    {formatNumberUSStyle(r.exhaustedVP, true)} VP exhausted (no remaining ranked
                    choices)
                  </p>
                )}
                {r.eliminated.length > 0 && (
                  <p className="text-red-300/80 mt-1">
                    Eliminated: {r.eliminated.map(labelFor).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
