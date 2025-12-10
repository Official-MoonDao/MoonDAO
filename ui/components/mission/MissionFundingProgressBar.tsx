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
    <div className={`relative ${compact ? 'mb-2' : 'mb-4'} max-w-[800px]`}>
      {/* Progress bar with subtle glow for funded missions */}
      <div className={isFunded ? 'relative' : ''}>
        {isFunded && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-green-400/20 rounded-full blur-md" />
        )}
        <ProgressBar
          height={compact ? '24px' : '32px'}
          progress={stageProgress}
          label={`${stageProgress < 1 ? stageProgress.toFixed(2) : Math.floor(stageProgress)}%`}
          compact={compact}
          isCelebrating={isFunded}
        />
      </div>
    </div>
  )
}
