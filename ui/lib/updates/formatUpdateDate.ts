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

/** Format a required `YYYY-MM-DD` without a Date parse (timezone-safe). */
export default function formatUpdateDate(date: string) {
  const [year, month, day] = date.split('-')
  const monthName = month ? MONTHS[Number(month) - 1] : undefined

  if (!monthName) return year
  if (!day) return `${monthName} ${year}`
  return `${monthName} ${Number(day)}, ${year}`
}
