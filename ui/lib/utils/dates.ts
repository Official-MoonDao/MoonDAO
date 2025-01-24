import { BigNumber } from 'ethers'

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
