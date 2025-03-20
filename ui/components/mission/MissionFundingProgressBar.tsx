import Image from 'next/image'
import { useRef } from 'react'
import ProgressBar from '../layout/ProgressBar'

export default function MissionFundingProgressBar({
  progress,
  label,
  goalAsPercentage = 0,
  goalIndicatorLabel,
}: any) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative mb-12" ref={containerRef}>
      <ProgressBar height="25px" progress={progress} label={label} />

      <div
        id="funding-goal-indicator-container"
        className="absolute flex items-center gap-2 -bottom-12"
        style={{ left: `${goalAsPercentage - 2.5}%` }}
      >
        <Image
          id="funding-goal-indicator"
          src="/assets/launchpad/funding-goal-indicator.svg"
          alt="funding goal indicator"
          width={30}
          height={30}
        />
        {goalIndicatorLabel && (
          <p className="text-[#425eeb] font-GoodTimes font-bold">
            {goalIndicatorLabel}
          </p>
        )}
      </div>
    </div>
  )
}
