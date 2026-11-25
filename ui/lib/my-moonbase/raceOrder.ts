import { parseAtlasYear } from '@/lib/lunar-atlas/selectors'
import type { SharedGoal } from '@/lib/lunar-atlas/types'

// Races expected soonest come first, so a base can be built in the order the
// Moon gets it: by the start of the target window, then by its end. Races
// with no window sort last. Ties keep their dataset order.
export function compareRacesBySchedule(a: SharedGoal, b: SharedGoal): number {
  const key = (goal: SharedGoal) => {
    const from = parseAtlasYear(goal.targetWindow?.from ?? goal.targetWindow?.to)
    const to = parseAtlasYear(goal.targetWindow?.to ?? goal.targetWindow?.from)
    return [from ?? Infinity, to ?? Infinity]
  }
  const [aFrom, aTo] = key(a)
  const [bFrom, bTo] = key(b)
  if (aFrom !== bFrom) return aFrom - bFrom
  if (aTo !== bTo) return aTo - bTo
  return 0
}
