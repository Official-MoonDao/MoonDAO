import Image from 'next/image'
import { useRef } from 'react'
import { truncateTokenValue } from '@/lib/utils/numbers'
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
  const containerRef = useRef<HTMLDivElement>(null)

  const progress =
    volume && fundingGoal ? (volume / (fundingGoal / 1e18)) * 100 : 0
  const goalAsPercentage = 10

  return (
    <div
      className={`relative ${compact ? 'mb-4' : 'mb-12'} max-w-[800px]`}
      ref={containerRef}
    >
      {compact && (
        <div className="text-left text-light-warm mb-1">
          {volume} / {truncateTokenValue(fundingGoal / 1e18, 'ETH')} ETH
        </div>
      )}

      <ProgressBar
        height={compact ? '10px' : '25px'}
        progress={progress}
        label={compact ? undefined : `${volume} ETH`}
        compact={compact}
      />

      {!compact && progress >= goalAsPercentage && (
        <div
          id="funding-goal-indicator-container"
          className="absolute flex items-center gap-2 -bottom-12 left-[7%]"
        >
          <Image
            id="funding-goal-indicator"
            src="/assets/launchpad/funding-goal-indicator.svg"
            alt="funding goal indicator"
            width={30}
            height={30}
          />

          <p className="text-[#425eeb] font-GoodTimes font-bold">
            {`${(fundingGoal / 1e18) * 0.1} ETH secured`}
          </p>
        </div>
      )}
    </div>
  )
}
