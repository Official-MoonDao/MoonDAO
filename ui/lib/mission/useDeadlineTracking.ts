import { useEffect, useState } from 'react'
import { formatTimeUntilDeadline } from '../utils/dates'

type UseDeadlineTrackingReturn = {
  duration: string | undefined
  deadlinePassed: boolean
  refundPeriodPassed: boolean
}

/**
 * Hook to track deadline and refund period with countdown timer
 * Auto-refreshes stage when deadline or refund period passes
 */
export function useDeadlineTracking(
  deadline: number | undefined,
  refundPeriod: number | undefined,
  refreshStage?: () => void
): UseDeadlineTrackingReturn {
  const [duration, setDuration] = useState<string | undefined>()
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [refundPeriodPassed, setRefundPeriodPassed] = useState(false)
  const [hasRefreshedStageAfterDeadline, setHasRefreshedStageAfterDeadline] = useState(false)
  const [hasRefreshedStageAfterRefundPeriod, setHasRefreshedStageAfterRefundPeriod] =
    useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (deadline !== undefined && deadline !== null && deadline !== 0) {
        const newDuration = formatTimeUntilDeadline(new Date(deadline))
        setDuration(newDuration)

        const isDeadlinePassed = deadline < Date.now()

        // Only update deadlinePassed if it actually changed
        if (isDeadlinePassed) {
          setDeadlinePassed(isDeadlinePassed)
        }

        // If deadline just passed and we haven't refreshed stage yet, do it now
        if (isDeadlinePassed && !hasRefreshedStageAfterDeadline && refreshStage) {
          setTimeout(() => {
            refreshStage()
            setHasRefreshedStageAfterDeadline(true)
          }, 3000)
        }

        // Reset the flag if deadline is not passed (in case deadline changes)
        if (!isDeadlinePassed && hasRefreshedStageAfterDeadline) {
          setHasRefreshedStageAfterDeadline(false)
        }

        if (refundPeriod !== undefined && refundPeriod !== null && refundPeriod !== 0) {
          const isRefundPeriodPassed = deadline + refundPeriod < Date.now()

          if (isRefundPeriodPassed) {
            setRefundPeriodPassed(isRefundPeriodPassed)
          }

          if (isRefundPeriodPassed && !hasRefreshedStageAfterRefundPeriod && refreshStage) {
            refreshStage()
            setHasRefreshedStageAfterRefundPeriod(true)
          }
          if (!isRefundPeriodPassed && hasRefreshedStageAfterRefundPeriod) {
            setHasRefreshedStageAfterRefundPeriod(false)
          }
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [
    deadline,
    refundPeriod,
    hasRefreshedStageAfterDeadline,
    hasRefreshedStageAfterRefundPeriod,
    refreshStage,
  ])

  return {
    duration,
    deadlinePassed,
    refundPeriodPassed,
  }
}

