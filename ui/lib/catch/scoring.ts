/**
 * Catch scoring. Partial credit everywhere and no cliffs.
 *
 * A catch earns up to 1,100, times 1.25 in Pro:
 *
 *   the catch itself   250
 *   sweet spot         350, for where in the arms the ship was taken:
 *       depth   150  how far along the rails the pins came down. The sweet
 *                    spot is marked by the ring; out at the arm tips or deep
 *                    in against the tower still holds, for less.
 *       center  100  how evenly it sat between the two arms
 *       height  100  how high the pins were above the rails when the arms
 *                    took hold. About 3 m is ideal. Lower and they only just
 *                    got under the pins; higher and the ship had a long drop
 *                    onto them.
 *   soft               250  how gently the pins met the rails
 *   steady             100  how little it was still drifting sideways when the pins landed
 *   fuel               150  share of the burn left
 *
 * No catch still earns something: up to 200 for how close the pins came to
 * the sweet spot, plus 120 for a soft splashdown in the Gulf or 60 for
 * setting it down gently on the ground (it has no legs, but it was a nice try).
 *
 * Damage to the base comes off after everything else, per structure, so a
 * fireball in the tank farm goes well below zero.
 *
 * Dependency-free: imported by the headless bot.
 */
import type { ModeId } from './modes'
import { SWEET_MARGIN, type CrashCause, type Outcome, type Sim, type StructureId } from './physics'

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

export const CATCH_POINTS = 250
export const DEPTH_POINTS = 150
export const CENTER_POINTS = 100
export const HEIGHT_POINTS = 100
export const SOFT_POINTS = 250
export const STEADY_POINTS = 100
export const FUEL_POINTS = 150
export const NEAR_MISS_POINTS = 200
export const SPLASHDOWN_POINTS = 120
export const DITCH_POINTS = 60

/** How far the pins can come down from the sweet spot and still be on the rails (m). */
export const DEPTH_REACH_TIPS = 13
export const DEPTH_REACH_TOWER = 15

export type FlightResult = {
  mode: ModeId
  outcome: Outcome
  cause: CrashCause | null
  score: number
  /** Points before damage and the mode multiplier, by part. */
  parts: { caught: number; depth: number; center: number; height: number; soft: number; steady: number; fuel: number; near: number; water: number }
  damage: StructureId[]
  damageCost: number
  /** m/s the pins met the rails at, or the impact's vertical speed. */
  closingSpeed: number
  horizontalSpeed: number
  tiltDeg: number
  /** m from the sweet spot: along the arms (+ toward the tower) and across them. */
  along: number
  across: number
  /** m: nearest the pins came to the sweet spot. */
  closest: number
  /** m: height of the pins above the rails when the arms took hold (0 if they never did). */
  armMargin: number
  fuelLeft: number
  flightSeconds: number
}

const taper = (v: number, full: number, zero: number) => (v <= full ? 1 : v >= zero ? 0 : 1 - (v - full) / (zero - full))

/** 0..1 for how far along the rails the pins came down. */
export function depthFactor(along: number): number {
  return along < 0 ? taper(-along, 1, DEPTH_REACH_TIPS) : taper(along, 1, DEPTH_REACH_TOWER)
}

/** 0..1 for the height of the pins above the rails when the arms took hold. */
export function heightFactor(margin: number): number {
  const lo = SWEET_MARGIN - 1
  const hi = SWEET_MARGIN + 1.5
  if (margin < lo) return 0.25 + 0.75 * Math.max(0, margin / lo)
  if (margin > hi) return 0.2 + 0.8 * taper(margin, hi, 16)
  return 1
}

export function scoreFlight(s: Sim): FlightResult {
  const mode = s.mode
  const outcome: Outcome = s.outcome ?? 'lost'
  const parts = { caught: 0, depth: 0, center: 0, height: 0, soft: 0, steady: 0, fuel: 0, near: 0, water: 0 }
  const fuelLeft = s.fuel / mode.fuelSeconds
  if (outcome === 'caught') {
    parts.caught = CATCH_POINTS
    parts.depth = Math.round(DEPTH_POINTS * depthFactor(s.endAlong))
    parts.center = Math.round(CENTER_POINTS * taper(Math.abs(s.endAcross), 0.5, 6))
    parts.height = Math.round(HEIGHT_POINTS * heightFactor(s.hugMargin))
    parts.soft = Math.round(SOFT_POINTS * taper(s.endVertical, 2, mode.pinLimit))
    parts.steady = Math.round(STEADY_POINTS * taper(s.endHorizontal, 0.5, 5))
    parts.fuel = Math.round(FUEL_POINTS * Math.min(1, fuelLeft / 0.3))
  } else {
    parts.near = Math.round(NEAR_MISS_POINTS * taper(s.closest, 2, 60))
    if (outcome === 'splashdown') parts.water = SPLASHDOWN_POINTS
    if (outcome === 'ditched') parts.water = DITCH_POINTS
  }
  const sum = parts.caught + parts.depth + parts.center + parts.height + parts.soft + parts.steady + parts.fuel + parts.near + parts.water
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
