import type { PressDate } from './press-data'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Dates are stored at whatever precision we could verify, so a full Date parse would
// both invent a day we don't have and shift it by the reader's timezone.
export default function formatPressDate(date: PressDate) {
  const [year, month, day] = date.split('-')
  const monthName = month ? MONTHS[Number(month) - 1] : undefined

  if (!monthName) return year
  if (!day) return `${monthName} ${year}`
  return `${monthName} ${Number(day)}, ${year}`
}

export function pressYear(date: PressDate) {
  return date.slice(0, 4)
}
