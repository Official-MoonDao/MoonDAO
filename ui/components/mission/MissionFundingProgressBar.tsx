import ProgressBar from '../layout/ProgressBar'

export default function MissionFundingProgressBar({
  fundingGoal,
  volume,
  compact = false,
  progressOverride,
  caption,
}: {
  fundingGoal: number
  volume: number
  compact?: boolean
  /** When set, bar % uses this value (e.g. milestone-relative progress) instead of volume/goal */
  progressOverride?: number
  caption?: string
}) {
  const rawProgress =
    progressOverride !== undefined
      ? progressOverride
      : volume && fundingGoal
      ? (volume / (fundingGoal / 1e18)) * 100
      : 0
  const stageProgress = Number.isFinite(rawProgress)
    ? Math.min(100, Math.max(0, rawProgress))
    : 0
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
        isCelebrating={isFunded}
      />
      {caption ? (
        <p className={`text-gray-400 ${compact ? 'text-[11px] mt-1.5 leading-snug' : 'text-xs mt-2'}`}>
          {caption}
        </p>
      ) : null}
    </div>
  )
}
