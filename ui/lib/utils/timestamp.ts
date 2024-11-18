export function daysUntilTimestamp(timestamp: number) {
  const now = new Date()
  const then = new Date(timestamp * 1000)
  const diff = then.getTime() - now.getTime()
  const days = Math.round(diff / (1000 * 60 * 60 * 24))
  return days
}

// Get the number of days since the timestamp
export function daysSinceTimestamp(timestamp: number) {
  const now = new Date()
  const then = new Date(timestamp * 1000)
  const diff = now.getTime() - then.getTime()
  const days = Math.round(diff / (1000 * 60 * 60 * 24))
  return days
}

export function daysFromNowTimestamp(days: number) {
  return Math.floor(Date.now() / 1000) + days * 86400
}
