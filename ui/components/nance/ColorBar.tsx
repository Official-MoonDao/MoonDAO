import { classNames } from '@/lib/utils/tailwind'

export const JB_THRESHOLD = 80_000_000

const COLOR_VARIANTS: { [key: string]: string } = {
  green: 'bg-green-500',
  red: 'bg-red-500',
  gray: 'bg-gray-200',
}
const WIDTH_VARIANTS: { [key: number]: string } = {
  0: 'w-0',
  1: 'w-1/12',
  2: 'w-2/12',
  3: 'w-3/12',
  4: 'w-4/12',
  5: 'w-5/12',
  6: 'w-6/12',
  7: 'w-7/12',
  8: 'w-8/12',
  9: 'w-9/12',
  10: 'w-10/12',
  11: 'w-11/12',
  12: 'w-full',
}
const TOTAL_WIDTH = 12

function ColorDiv({ color, width }: { color: string; width: number }) {
  if (!width) return null

  return (
    <div
      className={classNames(
        COLOR_VARIANTS[color],
        WIDTH_VARIANTS[width],
        'h-3 first:rounded-l-full last:rounded-r-full'
      )}
    />
  )
}

interface ColorBarProps {
  /**
   * The number of for votes for the proposal.
   */
  greenScore: number
  /**
   * The number of against votes for the proposal.
   */
  redScore: number
  /**
   * Whether to show the tooltip.
   */
  noTooltip?: boolean
  /**
   * The threshold of greenScore+redScore for the proposal to pass. Defaults to @see JB_THRESHOLD.
   */
  threshold?: number
  /**
   * The min percent of greenScore/(greenScore+redScore) for the proposal to pass. Defaults to 0.66
   */
  approvalPercent?: number
  /**
   * Custom background color for the bar. Defaults to gray-200/gray-700
   */
  backgroundColor?: string
}

/**
 * ColorBar which shows the votes weight of a proposal and the progress towards the threshold.
 * @param greenScore The number of for votes for the proposal.
 * @param redScore The number of against votes for the proposal.
 * @param noTooltip Whether to show the tooltip.
 * @param threshold The threshold of greenScore+redScore for the proposal to pass. Defaults to @see JB_THRESHOLD.
 * @param approvalPercent The min percent of greenScore/(greenScore+redScore) for the proposal to pass. Defaults to 0.66.
 */
export default function ColorBar({
  greenScore,
  redScore,
  noTooltip = false,
  threshold = JB_THRESHOLD,
  approvalPercent = 0.66,
  backgroundColor,
}: ColorBarProps) {
  const totalScore = greenScore + redScore
  const hasPass = totalScore >= threshold && greenScore / totalScore >= approvalPercent
  const shouldDisplayVerticalLine =
    totalScore >= threshold && greenScore / totalScore < approvalPercent
  const colorWidth = Math.min(TOTAL_WIDTH, Math.round((totalScore / threshold) * TOTAL_WIDTH))
  const grayWidth = TOTAL_WIDTH - colorWidth

  const greenWidth = Math.round((greenScore / totalScore) * colorWidth)
  const redWidth = Math.round((redScore / totalScore) * colorWidth)

  const renderBar = () => (
    <>
      <div
        className={`flex h-3 w-full min-w-[14rem] flex-row rounded-full ${backgroundColor || 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <ColorDiv color="green" width={greenWidth} />
        <ColorDiv color="red" width={redWidth} />
        <ColorDiv color="gray" width={grayWidth} />
      </div>
      {shouldDisplayVerticalLine && <div className="relative z-10 -mt-3 h-3 w-8/12 border-r-2" />}
    </>
  )

  if (noTooltip) {
    return renderBar()
  }

  return (
    <div
      data-tip={`${hasPass ? '✅' : '❌'} For ${((greenScore / (greenScore + redScore)) * 100).toFixed()}%, Against ${((redScore / (greenScore + redScore)) * 100).toFixed()}%`}
      className="tooltip"
    >
      {renderBar()}
    </div>
  )
}
