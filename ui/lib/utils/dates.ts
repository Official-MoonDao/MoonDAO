import { BigNumber } from 'ethers'

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

  // Calculate time units
  const seconds = Math.floor(timeDifference / 1000) % 60
  const minutes = Math.floor(timeDifference / (1000 * 60)) % 60
  const hours = Math.floor(timeDifference / (1000 * 60 * 60)) % 24
  const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24))

  // Format based on remaining time
  if (days >= 2) {
    // More than 48 hours: show days and hours
    return `${days} DAYS, ${hours} HOURS`
  } else if (days === 1) {
    // Between 24-48 hours: show day (singular) and hours
    return `${days} DAY, ${hours} HOURS`
  } else if (hours >= 1) {
    // Less than 24 hours: show hours and minutes
    return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'}, ${minutes} ${
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

export function isRewardsCycle(date: Date) {
  if (true) return false
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

export function isApprovalActive(date: Date) {
  if (true) return true
  const lastQuarter = getRelativeQuarter(-1)
  const endOfQuarter = new Date(lastQuarter.year, lastQuarter.quarter * 3, 0)
  const nextQuarterStart = new Date(lastQuarter.year, lastQuarter.quarter * 3, 1)

  const twentyOneDaysIntoNextQuarter = new Date(nextQuarterStart)
  twentyOneDaysIntoNextQuarter.setDate(twentyOneDaysIntoNextQuarter.getDate() + 21)

  const firstThursdayAfterTwentyOneDays = new Date(twentyOneDaysIntoNextQuarter)
  const daysUntilThursday = daysUntilDay(twentyOneDaysIntoNextQuarter, 'Thursday')
  firstThursdayAfterTwentyOneDays.setDate(
    firstThursdayAfterTwentyOneDays.getDate() + daysUntilThursday
  )

  return date >= endOfQuarter && date <= firstThursdayAfterTwentyOneDays
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

function getThirdThursdayOfQuarterTimestamp(quarter, year) {
  const startMonth = (quarter - 1) * 3
  const date = new Date(year, startMonth, 1)
  const THURSDAY = 4
  let currentDayOfWeek = date.getDay()
  const daysToAdd = (THURSDAY - currentDayOfWeek + 7) % 7
  date.setDate(date.getDate() + daysToAdd)
  date.setDate(date.getDate() + 14)
  return date
}
