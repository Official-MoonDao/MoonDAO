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
    volume && fundingGoal ? (volume / (fundingGoal / 1e18)) * 100 : 0

  if (stage === 3) return null

  return (
    <div className={`relative mb-4 max-w-[800px]`}>
      <ProgressBar
        height={compact ? '20px' : '25px'}
        progress={stageProgress}
        label={`${
          stageProgress < 1
            ? stageProgress.toFixed(2)
            : Math.round(stageProgress)
        }%`}
        compact={compact}
      />
    </div>
  )
}
