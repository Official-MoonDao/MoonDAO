import { BigNumber } from 'ethers'

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

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
  const currentQuarter = getRelativeQuarter(0)
  const endOfQuarter = new Date(
    currentQuarter.year,
    currentQuarter.quarter * 3,
    0
  )
  const nextQuarterStart = new Date(
    currentQuarter.year,
    currentQuarter.quarter * 3,
    1
  )

  const sevenDaysIntoNextQuarter = new Date(nextQuarterStart)
  sevenDaysIntoNextQuarter.setDate(sevenDaysIntoNextQuarter.getDate() + 7)

  const firstTuesdayAfterSevenDays = new Date(sevenDaysIntoNextQuarter)
  const daysUntilTuesday = daysUntilDay(sevenDaysIntoNextQuarter, 'Tuesday')
  firstTuesdayAfterSevenDays.setDate(
    firstTuesdayAfterSevenDays.getDate() + daysUntilTuesday
  )

  return date >= endOfQuarter && date <= firstTuesdayAfterSevenDays
}
