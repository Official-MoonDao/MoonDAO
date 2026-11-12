/**
 * Daily mission + deterministic RNG for Touchdown.
 *
 * Everyone gets the same map on a given UTC day. The seed derives from the
 * mission NUMBER (not the date string) so a challenge link can replay an
 * older mission exactly.
 *
 * Dependency-free: imported by the headless bot (scripts/touchdown-bot.ts).
 */

/** Mission #1 is 2026-11-11 UTC. */
export const MISSION_EPOCH_UTC = Date.UTC(2026, 10, 11)
const DAY_MS = 86_400_000

export function missionNumberFor(nowMs: number = Date.now()): number {
  return Math.max(1, Math.floor((nowMs - MISSION_EPOCH_UTC) / DAY_MS) + 1)
}

export function missionDateLabel(mission: number): string {
  return new Date(MISSION_EPOCH_UTC + (mission - 1) * DAY_MS).toISOString().slice(0, 10)
}

/** 32-bit integer hash (murmur-style finalizer). */
export function hash32(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

export function missionSeed(mission: number): number {
  return hash32(mission * 7919 + 0x7d0)
}

export type Rng = () => number

/** mulberry32: small, fast, good enough for terrain. Returns [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
