import Image from 'next/image'
import { useRef } from 'react'
import { MISSION_STAGE_NAMES } from '@/lib/mission/missionConfig'
import ProgressBar from '../layout/ProgressBar'

export default function MissionFundingProgressBar({
  fundingGoal,
  volume,
  stage,
  compact = false,
}: {
  fundingGoal: number
  volume: number
  stage?: number
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const stageGoals = [undefined, fundingGoal * 0.2, fundingGoal, undefined]
  const stageGoal = stageGoals?.[stage ?? 0] || 0
  const stageProgress =
    stage === 3
      ? 100
      : volume && stageGoal
      ? Math.round((volume / (stageGoal / 1e18)) * 100)
      : 0
  const goalAsPercentage = 20

  if (stage !== 1 && stage !== 2 && stage !== 3) return null

  return (
    <div
      className={`relative ${compact ? 'mb-4' : 'mb-12'} max-w-[800px]`}
      ref={containerRef}
    >
      <div className="text-left mb-1">
        {`Stage ${stage}: ${MISSION_STAGE_NAMES?.[stage ?? 0]}`}
      </div>

      <ProgressBar
        height={compact ? '20px' : '25px'}
        progress={stageProgress}
        label={`${stageProgress}%`}
        compact={compact}
      />

      {!compact &&
        stageProgress >= goalAsPercentage &&
        (stage === 2 || stage === 3) && (
          <div
            id="funding-goal-indicator-container"
            className="absolute flex items-center gap-2 -bottom-12 left-[17%]"
          >
            <Image
              id="funding-goal-indicator"
              src="/assets/launchpad/funding-goal-indicator.svg"
              alt="funding goal indicator"
              width={30}
              height={30}
            />

            <p className="text-[#425eeb] font-GoodTimes font-bold">
              {+stage === 3
                ? `Funding Goal Achieved`
                : `Ignition Goal Achieved`}
            </p>
          </div>
        )}
    </div>
  )
}
