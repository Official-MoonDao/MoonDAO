import Image from 'next/image'
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
  const goalAsPercentage = 20
  const stageProgress =
    volume && fundingGoal
      ? Math.round((volume / (fundingGoal / 1e18)) * 100)
      : 0

  if (stage === 3) return null

  return (
    <div className={`relative mb-4 max-w-[800px]`}>
      <ProgressBar
        height={compact ? '20px' : '25px'}
        progress={stageProgress}
        label={`${stageProgress}%`}
        compact={compact}
      />

      {!compact && stageProgress >= goalAsPercentage && stage === 2 && (
        <div
          id="funding-goal-indicator-container"
          className="absolute flex items-center gap-2 -bottom-12 left-[17%]"
        >
          <Image
            id="funding-goal-indicator"
            src="/assets/launchpad/funding-goal-indicator.svg"
            alt="min funding goal indicator"
            width={30}
            height={30}
          />

          <p className="text-[#425eeb] font-GoodTimes font-bold">
            {`Min Funding Goal Achieved`}
          </p>
        </div>
      )}
    </div>
  )
}
