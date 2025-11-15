import ProgressBar from '../layout/ProgressBar'

export default function MissionFundingProgressBar({
  fundingGoal,
  volume,
  compact = false,
}: {
  fundingGoal: number
  volume: number
  compact?: boolean
}) {
  const stageProgress = volume && fundingGoal ? (volume / (fundingGoal / 1e18)) * 100 : 0

  return (
    <div className={`relative ${compact ? 'mb-2' : 'mb-4'} max-w-[800px]`}>
      <ProgressBar
        height={compact ? '24px' : '32px'}
        progress={stageProgress}
        label={`${stageProgress < 1 ? stageProgress.toFixed(2) : Math.floor(stageProgress)}%`}
        compact={compact}
      />
    </div>
  )
}
