/**
 * Catch scoring. Partial credit everywhere and no cliffs.
 *
 * A catch earns: the catch itself 300 + softness 300 + alignment 200 +
 * upright 100 + fuel 150 + arm timing 150 = 1,200, times 1.25 in Pro.
 *
 *   softness   how gently the pins met the rails: full at 1.5 m/s or less,
 *              tapering to nothing at the speed that shears the pins
 *   alignment  how central the ship sat between and along the arms
 *   upright    how near vertical it hung
 *   fuel       share of the burn left
 *   timing     how late the arms closed: full with the pins 3 m or less above
 *              the rails, tapering to nothing at 20 m. On Easy the tower
 *              closes them for you and this is a flat 90.
 *
 * No catch still earns something: up to 200 for how close the pins came to
 * the rails, plus 120 for a soft splashdown in the Gulf or 60 for setting it
 * down gently on the ground (it has no legs, but it was a nice try).
 *
 * Damage to the base comes off after everything else, per structure, so a
 * fireball in the tank farm goes well below zero.
 *
 * Dependency-free: imported by the headless bot.
 */
import type { ModeId } from './modes'
import type { CrashCause, Outcome, Sim, StructureId } from './physics'

export const DAMAGE_COST: Record<StructureId, number> = {
  tower: 300,
  arms: 200,
  mount: 150,
  tankfarm: 400,
  tower2: 300,
  booster: 350,
  mount2: 150,
  plant: 100,
  hopper: 250,
  highway: 50,
}

export const CATCH_POINTS = 300
export const SOFT_POINTS = 300
export const ALIGN_POINTS = 200
export const UPRIGHT_POINTS = 100
export const FUEL_POINTS = 150
export const TIMING_POINTS = 150
export const EASY_TIMING_POINTS = 90
export const NEAR_MISS_POINTS = 200
export const SPLASHDOWN_POINTS = 120
export const DITCH_POINTS = 60

export type FlightResult = {
  mode: ModeId
  outcome: Outcome
  cause: CrashCause | null
  score: number
  /** Points before damage and the mode multiplier, by part. */
  parts: { caught: number; soft: number; align: number; upright: number; fuel: number; timing: number; near: number; water: number }
  damage: StructureId[]
  damageCost: number
  /** m/s the pins met the rails at, or the impact's vertical speed. */
  closingSpeed: number
  horizontalSpeed: number
  tiltDeg: number
  /** m off the ideal position, along and across the arms. */
  along: number
  across: number
  /** m: nearest the pins came to their place on the rails. */
  closest: number
  /** m: height of the pins above the rails when the arms took hold (0 if they never did). */
  armMargin: number
  fuelLeft: number
  flightSeconds: number
}

const taper = (v: number, full: number, zero: number) => (v <= full ? 1 : v >= zero ? 0 : 1 - (v - full) / (zero - full))

export function scoreFlight(s: Sim): FlightResult {
  const mode = s.mode
  const outcome: Outcome = s.outcome ?? 'lost'
  const parts = { caught: 0, soft: 0, align: 0, upright: 0, fuel: 0, timing: 0, near: 0, water: 0 }
  const fuelLeft = s.fuel / mode.fuelSeconds
  if (outcome === 'caught') {
    parts.caught = CATCH_POINTS
    parts.soft = Math.round(SOFT_POINTS * taper(s.endVertical, 1.5, mode.pinLimit))
    // Across the arms matters most: 0.5 m is centred, 5 m is hanging off one rail.
    const off = Math.sqrt(s.endAcross * s.endAcross + 0.25 * s.endAlong * s.endAlong)
    parts.align = Math.round(ALIGN_POINTS * taper(off, 0.5, 6))
    parts.upright = Math.round(UPRIGHT_POINTS * taper(s.endTilt, 1, 14))
    parts.fuel = Math.round(FUEL_POINTS * Math.min(1, fuelLeft / 0.4))
    parts.timing = mode.autoArms ? EASY_TIMING_POINTS : Math.round(TIMING_POINTS * taper(s.hugMargin, 3, 20))
  } else {
    parts.near = Math.round(NEAR_MISS_POINTS * taper(s.closest, 2, 60))
    if (outcome === 'splashdown') parts.water = SPLASHDOWN_POINTS
    if (outcome === 'ditched') parts.water = DITCH_POINTS
  }
  const sum = parts.caught + parts.soft + parts.align + parts.upright + parts.fuel + parts.timing + parts.near + parts.water
  let damageCost = 0
  for (const id of s.damage) damageCost += DAMAGE_COST[id]
  const score = Math.round(sum * mode.scoreMultiplier) - damageCost
  return {
    mode: mode.id,
    outcome,
    cause: s.cause,
    score,
    parts,
    damage: s.damage.slice(),
    damageCost,
    closingSpeed: s.endVertical,
    horizontalSpeed: s.endHorizontal,
    tiltDeg: s.endTilt,
    along: s.endAlong,
    across: s.endAcross,
    closest: s.closest,
    armMargin: s.hugMargin > 0 ? s.hugMargin : 0,
    fuelLeft,
    flightSeconds: s.t,
  }
}
