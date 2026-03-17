import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import Link from 'next/link'
import { STATUS_CONFIG } from '@/lib/nance/useProposalStatus'

export type SnapshotProposal = {
  id: string
  title: string
  state: string // 'closed' | 'active' | 'pending'
  choices: string[]
  scores: number[]
  scores_total: number
  votes: number
  quorum: number
  start: number
  end: number
  author: string
}

function SnapshotStatusBadge({ state }: { state: string }) {
  const statusMap: Record<string, keyof typeof STATUS_CONFIG> = {
    active: 'Voting',
    closed: 'Archived',
    pending: 'Discussion',
  }
  const mappedStatus = statusMap[state] || 'Archived'
  const config = STATUS_CONFIG[mappedStatus] || STATUS_CONFIG['Archived']

  const label = state === 'active' ? 'Active' : state === 'closed' ? 'Closed' : 'Pending'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm`}
      >
        <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
        <span
          className={`text-xs font-medium ${config.text} font-RobotoMono uppercase tracking-wider`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function ScoreBar({
  choice,
  score,
  total,
}: {
  choice: string
  score: number
  total: number
}) {
  const pct = total > 0 ? (score / total) * 100 : 0
  const colorMap: Record<string, string> = {
    for: 'bg-emerald-500',
    yes: 'bg-emerald-500',
    against: 'bg-red-500',
    no: 'bg-red-500',
    abstain: 'bg-gray-500',
  }
  const barColor = colorMap[choice.toLowerCase()] || 'bg-blue-500'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-400 font-RobotoMono truncate">{choice}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-gray-400 font-RobotoMono">
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

export default function SnapshotProposalCard({
  proposal,
}: {
  proposal: SnapshotProposal
}) {
  const snapshotUrl = `https://snapshot.box/#/s:tomoondao.eth/proposal/${proposal.id}`

  const timeLabel =
    proposal.state === 'active'
      ? `Ends ${formatDistanceToNow(fromUnixTime(proposal.end), { addSuffix: true })}`
      : `Ended ${formatDistanceToNow(fromUnixTime(proposal.end), { addSuffix: true })}`

  return (
    <Link
      href={snapshotUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <div className="relative flex flex-col h-full justify-between gap-y-4 px-4 py-5 sm:px-6">
        <div className="flex-1">
          {/* Title & Status */}
          <div className="flex items-start gap-2">
            <SnapshotStatusBadge state={proposal.state} />
          </div>
          <h3
            className="mt-2 text-lg font-semibold text-white hover:text-gray-300 transition-colors line-clamp-2"
            style={{ fontFamily: 'Lato' }}
          >
            {proposal.title}
          </h3>

          {/* Score Bars (top 3 choices) */}
          {proposal.scores && proposal.scores.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {proposal.choices.slice(0, 3).map((choice, i) => (
                <ScoreBar
                  key={choice}
                  choice={choice}
                  score={proposal.scores[i] || 0}
                  total={proposal.scores_total}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 font-RobotoMono">{timeLabel}</span>
            <span className="text-xs text-gray-500 font-RobotoMono">
              {proposal.votes} vote{proposal.votes !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="font-RobotoMono">Snapshot</span>
            <ChevronRightIcon className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
          </div>
        </div>
      </div>
    </Link>
  )
}
