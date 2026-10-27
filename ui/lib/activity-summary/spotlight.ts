const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Picks one item for the day: stable for a whole UTC day, and steps through
 * the pool one item per day, so consecutive days never repeat (unless the
 * pool has one item). Sorting by id first keeps the order independent of how
 * the source returned rows. `salt` offsets each category so they don't all
 * advance in lockstep through similarly sized pools.
 */
export function pickForDay<T extends { id: number }>(
  pool: T[],
  now: Date,
  salt = 0
): T | undefined {
  if (pool.length === 0) return undefined
  const sorted = [...pool].sort((a, b) => a.id - b.id)
  const day = Math.floor(now.getTime() / DAY_MS)
  return sorted[(day + salt) % sorted.length]
}
