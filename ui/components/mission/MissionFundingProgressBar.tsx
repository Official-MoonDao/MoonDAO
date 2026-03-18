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
  const isFunded = stageProgress >= 100

  return (
    <div className={`relative ${compact ? 'mb-1' : 'mb-3'}`}>
      {isFunded && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-green-400/10 to-emerald-400/10 rounded-full blur-lg" />
      )}
      <ProgressBar
        height={compact ? '20px' : '28px'}
        progress={stageProgress}
        label={`${stageProgress < 1 ? stageProgress.toFixed(2) : Math.floor(stageProgress)}%`}
        compact={compact}
        isCelebrating={isFunded}
      />
    </div>
  )
}
