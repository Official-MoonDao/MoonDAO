/**
 * Per-mission approach setup shared by the game and the headless bot, so both
 * fly the exact same flight for a given mission number.
 *
 * Dependency-free.
 */
import { mulberry32 } from './mission'

/** Sideways offset (m) of the approach track from the target. Same for everyone that day. */
export function lateralOffsetFor(seed: number): number {
  const rng = mulberry32(seed ^ 0x51ed270b)
  const magnitude = 25 + rng() * 45
  return (rng() < 0.5 ? -1 : 1) * magnitude
}
