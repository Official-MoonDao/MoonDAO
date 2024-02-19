export function dateToReadable(date: any) {
  return date && date.toISOString().substring(0, 10)
}

export function bigNumberToDate(bigNumber: any) {
  return bigNumber && new Date(bigNumber.mul(1000).toNumber())
}

export function dateOut(date: any, { days, years }: any) {
  if (!date) return
  let dateOut = date
  days && dateOut.setDate(date.getDate() + days)
  years && dateOut.setFullYear(date.getFullYear() + years)
  return dateOut
}

export const oneWeekOut = dateOut(new Date(), { days: 7 })
