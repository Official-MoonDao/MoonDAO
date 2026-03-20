import { CheckCircleIcon } from '@heroicons/react/24/solid'
import type { MissionFundingMilestone } from 'const/missionMilestones'
import { formatUsdCompact } from '@/lib/mission/milestoneProgress'

export default function MissionFundingMilestonesList({
  milestones,
  raisedUsd,
  nextMilestoneIndex,
}: {
  milestones: MissionFundingMilestone[]
  raisedUsd: number
  nextMilestoneIndex: number | null
}) {
  const sorted = [...milestones].sort((a, b) => a.usd - b.usd)

  return (
    <ul className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
      {sorted.map((m, i) => {
        const reached = raisedUsd >= m.usd
        const isNext = nextMilestoneIndex !== null && i === nextMilestoneIndex
        return (
          <li
            key={`${m.usd}-${m.label}`}
            className={`flex gap-2.5 items-start rounded-lg px-2 py-1.5 -mx-2 ${
              isNext ? 'bg-indigo-500/10 ring-1 ring-indigo-400/25' : ''
            }`}
          >
            <span className="mt-0.5 flex-shrink-0" aria-hidden>
              {reached ? (
                <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="block w-4 h-4 rounded-full border border-white/20 bg-white/[0.04]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-GoodTimes text-white text-sm">{formatUsdCompact(m.usd)}</span>
              <span className="text-gray-500 mx-1.5">·</span>
              <span className="text-gray-400 text-sm">{m.label}</span>
              {isNext && (
                <p className="text-indigo-300/90 text-[11px] mt-0.5 font-medium tracking-wide uppercase">
                  Next milestone
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
