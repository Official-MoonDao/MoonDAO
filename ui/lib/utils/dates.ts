import { PROJECT_CYCLE } from 'const/config'
import type { ProjectCyclePhase } from 'const/config'
import { BigNumber } from 'ethers'
import { getSubmissionTargetCycle } from '@/lib/projectCycle/cycleQuarters'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function dateToReadable(date: any) {
  return date && date.toISOString().substring(0, 10)
}

export function bigNumberToDate(bigNumber: BigNumber) {
  if (!bigNumber) return null
  const bigIntValue = BigInt(bigNumber.toString())
  return new Date(Number(bigIntValue) * 1000)
}

export function dateOut(date: any, { days, years }: any) {
  if (!date) return
  let dateOut = date
  days && dateOut.setDate(date.getDate() + days)
  years && dateOut.setFullYear(date.getFullYear() + years)
  return dateOut
}

export const oneWeekOut = dateOut(new Date(), { days: 7 })

export function getRelativeQuarter(offset: number = 0) {
  const now = new Date()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  const totalQuarters = currentQuarter + offset

  const quarter = ((((totalQuarters - 1) % 4) + 4) % 4) + 1
  const year = now.getFullYear() + Math.floor((totalQuarters - 1) / 4)

  return { quarter, year }
}

export function getCurrentQuarter(offset: number = 0) {
  return getRelativeQuarter(0)
}

export function daysUntilDate(date: Date) {
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatTimeUntilDeadline(deadline: Date): string {
  const now = new Date()
  const timeDifference = deadline.getTime() - now.getTime()

  // If deadline has passed
  if (timeDifference <= 0) {
    return '0 SECONDS'
  }

  const oneDayMs = 24 * 60 * 60 * 1000

  // More than 24 hours left: whole days only (no hours)
  if (timeDifference > oneDayMs) {
    const d = Math.floor(timeDifference / oneDayMs)
    return d === 1 ? '1 DAY' : `${d} DAYS`
  }

  // Calculate time units (deadline within the next 24 hours, inclusive of exactly 24h)
  const totalHours = Math.floor(timeDifference / (1000 * 60 * 60))
  const minutes = Math.floor(timeDifference / (1000 * 60)) % 60
  const seconds = Math.floor(timeDifference / 1000) % 60

  if (totalHours >= 1) {
    return `${totalHours} ${totalHours === 1 ? 'HOUR' : 'HOURS'}, ${minutes} ${
      minutes === 1 ? 'MINUTE' : 'MINUTES'
    }`
  } else if (minutes >= 1) {
    // Less than 1 hour: show minutes and seconds
    return `${minutes} ${minutes === 1 ? 'MINUTE' : 'MINUTES'}, ${seconds} ${
      seconds === 1 ? 'SECOND' : 'SECONDS'
    }`
  } else {
    // Less than 1 minute: show only seconds
    return `${seconds} ${seconds === 1 ? 'SECOND' : 'SECONDS'}`
  }
}

export function daysUntilDay(date: Date, day: string) {
  const targetDayIndex = DAYS_OF_WEEK.indexOf(day)

  if (targetDayIndex === -1) {
    throw new Error('Invalid day provided')
  }

  const currentDayIndex = date.getDay()
  const daysUntil = (targetDayIndex - currentDayIndex + 7) % 7

  return daysUntil === 0 ? 7 : daysUntil
}

export function isRewardsCycle(date: Date, override?: boolean) {
  if (override) return true
  const lastQuarter = getRelativeQuarter(-1)
  const endOfQuarter = new Date(lastQuarter.year, lastQuarter.quarter * 3, 0)
  const nextQuarterStart = new Date(lastQuarter.year, lastQuarter.quarter * 3, 1)

  const fourteenDaysIntoNextQuarter = new Date(nextQuarterStart)
  fourteenDaysIntoNextQuarter.setDate(fourteenDaysIntoNextQuarter.getDate() + 14)

  const firstTuesdayAfterFourteenDays = new Date(fourteenDaysIntoNextQuarter)
  const daysUntilTuesday = daysUntilDay(fourteenDaysIntoNextQuarter, 'Tuesday')
  firstTuesdayAfterFourteenDays.setDate(firstTuesdayAfterFourteenDays.getDate() + daysUntilTuesday)

  return date >= endOfQuarter && date <= firstTuesdayAfterFourteenDays
}

export function getSubmissionQuarter() {
  const lastQuarter = getRelativeQuarter(-1)
  const thisQuarter = getRelativeQuarter(0)
  const nextQuarter = getRelativeQuarter(1)
  const thisQuarterStart = new Date(lastQuarter.year, lastQuarter.quarter * 3, 1)

  const twentyOneDaysIntoThisQuarter = new Date(thisQuarterStart)
  twentyOneDaysIntoThisQuarter.setDate(twentyOneDaysIntoThisQuarter.getDate() + 21)

  const firstThursdayAfterTwentyOneDays = new Date(twentyOneDaysIntoThisQuarter)
  const daysUntilThursday = daysUntilDay(twentyOneDaysIntoThisQuarter, 'Thursday')
  firstThursdayAfterTwentyOneDays.setDate(
    firstThursdayAfterTwentyOneDays.getDate() + daysUntilThursday
  )

  return new Date() <= firstThursdayAfterTwentyOneDays ? thisQuarter : nextQuarter
}

export function getThirdThursdayOfQuarterTimestamp(quarter: number, year: number) {
  const startMonth = (quarter - 1) * 3
  const date = new Date(year, startMonth, 1)
  const THURSDAY = 4
  let currentDayOfWeek = date.getDay()
  const daysToAdd = (THURSDAY - currentDayOfWeek + 7) % 7
  date.setDate(date.getDate() + daysToAdd)
  date.setDate(date.getDate() + 14)
  return date
}

export function getSecondThursdayOfQuarter(quarter: number, year: number) {
  const date = getThirdThursdayOfQuarterTimestamp(quarter, year)
  date.setDate(date.getDate() - 7)
  return date
}

export function formatQuarterCycleLabel(quarter: number, year: number) {
  return `Q${quarter} ${year}`
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Display dates like `October 8, 2026` parse as midnight at the start of
// that day (UTC in production). Use the last millisecond so the advertised
// calendar day stays inclusive. Editing deadlines still use this. Submission
// windows use `submissionWindowClosesAt` instead.
export function endOfConfigDeadline(displayDate: string): Date {
  return new Date(`${displayDate} 23:59:59.999 UTC`)
}

const SUBMISSION_CLOSE_TIME_ZONE = 'America/Los_Angeles'
const SUBMISSION_CLOSE_HOUR = 3

function configCalendarDate(displayDate: string): { year: number; month: number; day: number } {
  const parsed = new Date(`${displayDate} 00:00:00 UTC`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid deadline date: ${displayDate}`)
  }
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  }
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  }
}

// Wall-clock time in an IANA zone, as a UTC instant. Two passes so the
// offset is taken from the target instant, including across a DST change.
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0)
  let utc = wanted
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  for (let i = 0; i < 2; i++) {
    const parts = dtf.formatToParts(new Date(utc))
    const map: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') map[part.type] = part.value
    }
    let partHour = Number(map.hour)
    let partDay = Number(map.day)
    let partMonth = Number(map.month)
    let partYear = Number(map.year)
    // Some engines report midnight as hour 24 on the previous calendar day.
    if (partHour === 24) {
      partHour = 0
      const next = addCalendarDays(partYear, partMonth, partDay, 1)
      partYear = next.year
      partMonth = next.month
      partDay = next.day
    }
    const asUtc = Date.UTC(
      partYear,
      partMonth - 1,
      partDay,
      partHour,
      Number(map.minute),
      Number(map.second)
    )
    utc = wanted - (asUtc - utc)
  }
  return new Date(utc)
}

// Submissions close at 3:00 AM Pacific on the morning after `displayDate`,
// plus `graceDays` extra calendar days. An October 8 deadline with no grace
// stays open through Thursday night and closes at 3:00 AM Pacific on October 9.
export function submissionWindowClosesAt(displayDate: string, graceDays = 0): Date {
  const start = configCalendarDate(displayDate)
  const closeDay = addCalendarDays(start.year, start.month, start.day, 1 + graceDays)
  return zonedWallTimeToUtc(
    closeDay.year,
    closeDay.month,
    closeDay.day,
    SUBMISSION_CLOSE_HOUR,
    0,
    SUBMISSION_CLOSE_TIME_ZONE
  )
}

export function getSubmissionWindowClose(): Date {
  return submissionWindowClosesAt(
    PROJECT_CYCLE.submissionDeadline,
    PROJECT_CYCLE.submissionGraceDays
  )
}

export function formatSubmissionWindowClose(closesAt: Date): {
  date: string
  timeLabel: string
  label: string
} {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: SUBMISSION_CLOSE_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(closesAt)
  // The close is always 3:00. Build the label ourselves so server and browser
  // don't disagree on the space Intl inserts before AM/PM.
  const hour12 = SUBMISSION_CLOSE_HOUR % 12 || 12
  const suffix = SUBMISSION_CLOSE_HOUR < 12 ? 'AM' : 'PM'
  const timeLabel = `${hour12}:00 ${suffix} Pacific`
  return { date, timeLabel, label: `${date}, ${timeLabel}` }
}

export function getSubmissionCycleInfo(phase: ProjectCyclePhase) {
  const { quarter, year } = getSubmissionTargetCycle(phase)
  const deadline = getSecondThursdayOfQuarter(quarter, year)
  const quarterLabel = formatQuarterCycleLabel(quarter, year)
  const isCurrentSlate = quarter === PROJECT_CYCLE.quarter && year === PROJECT_CYCLE.year

  const closesAt = isCurrentSlate
    ? getSubmissionWindowClose()
    : submissionWindowClosesAt(formatLongDate(deadline))

  return {
    quarter,
    year,
    quarterLabel,
    deadline,
    deadlineFormatted: formatSubmissionWindowClose(closesAt).label,
  }
}
