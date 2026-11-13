/**
 * Catch scoring. Partial credit everywhere and no cliffs.
 *
 * A catch earns up to 1,100, times 1.25 in Pro, in three figures:
 *
 *   catch   700  the quality of the catch: where in the arms the ship was
 *                taken and how square it sat. There is no award for simply
 *                being caught beyond a 100-point floor; the other 600 are
 *                  depth    30%  how far along the rails the pins came down.
 *                                The sweet spot is marked by the ring; out at
 *                                the arm tips or deep in against the tower
 *                                still holds, for less.
 *                  center   30%  how evenly it sat between the two arms
 *                  upright  25%  how near vertical it was when the arms took hold
 *                  height   15%  how high the pins were above the rails when
 *                                the arms took hold. About 3 m is ideal.
 *                None of these has a "good enough" band, and each falls
 *                fastest close to perfect, so the last few points are the
 *                hard ones.
 *   soft    250  how gently the pins met the rails: 100 for the closing
 *                speed (BURN settles the ship to a fixed sink rate, so this
 *                only separates a braked arrival from a fast one) and 150
 *                for how little it was still drifting sideways.
 *   fuel    150  share of the burn left
 *
 * A hard catch is one the pins missed or broke on, with the ship left hanging
 * by its forward flaps. It still counts, at half of everything above.
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

export const CATCH_POINTS = 700
/** What any catch on the pins is worth before its quality is counted. */
export const CATCH_FLOOR = 100
export const SOFT_POINTS = 250
/** Of SOFT_POINTS, the share for closing speed; the rest is sideways drift. */
export const SOFT_SPEED_POINTS = 100
export const FUEL_POINTS = 150
/** Share of a catch's points kept when the forward flaps did the catching. */
export const HARD_CATCH_SHARE = 0.5
export const NEAR_MISS_POINTS = 200
export const SPLASHDOWN_POINTS = 120
export const DITCH_POINTS = 60

/** How far the pins can come down from the sweet spot and still be on the rails (m). */
export const DEPTH_REACH_TIPS = 13
export const DEPTH_REACH_TOWER = 15

export type FlightResult = {
  mode: ModeId
  outcome: Outcome
  /** Caught by the forward flaps, not the pins. */
  hard: boolean
  cause: CrashCause | null
  score: number
  /** Points before damage and the mode multiplier, by part. */
  parts: { caught: number; soft: number; fuel: number; near: number; water: number }
  damage: StructureId[]
  damageCost: number
  /** m/s the pins met the rails at, or the impact's vertical speed. */
  closingSpeed: number
  horizontalSpeed: number
  tiltDeg: number
  /** Degrees off vertical when the arms took hold: what the catch figure is scored on. */
  catchTilt: number
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

/**
 * 0..1 for an error that should be zero. Only `exact` or less earns the full
 * figure (that is a measurement tolerance, not a comfort band); from there it
 * falls as the 3/2 power, steepest right next to perfect, reaching nothing at
 * `zero`. Square root only, never Math.pow: the server must round the same way
 * as every browser.
 */
const precision = (err: number, exact: number, zero: number) => {
  const u = taper(err, exact, zero)
  return u * Math.sqrt(u)
}

/** 0..1 for how far along the rails the pins came down. */
export function depthFactor(along: number): number {
  return along < 0 ? precision(-along, 0.1, DEPTH_REACH_TIPS) : precision(along, 0.1, DEPTH_REACH_TOWER)
}

/** 0..1 for the height of the pins above the rails when the arms took hold. */
export function heightFactor(margin: number): number {
  if (margin < SWEET_MARGIN) return 0.25 + 0.75 * precision(SWEET_MARGIN - margin, 0.15, SWEET_MARGIN)
  return 0.2 + 0.8 * precision(margin - SWEET_MARGIN, 0.15, 13)
}

export function scoreFlight(s: Sim): FlightResult {
  const mode = s.mode
  const outcome: Outcome = s.outcome ?? 'lost'
  const parts = { caught: 0, soft: 0, fuel: 0, near: 0, water: 0 }
  const fuelLeft = s.fuel / mode.fuelSeconds
  if (outcome === 'caught') {
    const quality =
      0.3 * depthFactor(s.endAlong) +
      0.3 * precision(Math.abs(s.endAcross), 0.05, 6) +
      0.25 * precision(s.hugTilt, 0.1, 8) +
      0.15 * heightFactor(s.hugMargin)
    parts.caught = Math.round(CATCH_FLOOR + (CATCH_POINTS - CATCH_FLOOR) * quality)
    parts.soft = Math.round(
      SOFT_SPEED_POINTS * taper(s.endVertical, mode.burnSink + 0.2, mode.pinLimit) + (SOFT_POINTS - SOFT_SPEED_POINTS) * precision(s.endHorizontal, 0.05, 5)
    )
    parts.fuel = Math.round(FUEL_POINTS * Math.min(1, fuelLeft / 0.3))
    if (s.hard) {
      const keys = ['caught', 'soft', 'fuel'] as const
      for (const k of keys) parts[k] = Math.round(parts[k] * HARD_CATCH_SHARE)
    }
  } else {
    parts.near = Math.round(NEAR_MISS_POINTS * taper(s.closest, 2, 60))
    if (outcome === 'splashdown') parts.water = SPLASHDOWN_POINTS
    if (outcome === 'ditched') parts.water = DITCH_POINTS
  }
  const sum = parts.caught + parts.soft + parts.fuel + parts.near + parts.water
  let damageCost = 0
  for (const id of s.damage) damageCost += DAMAGE_COST[id]
  const score = Math.round(sum * mode.scoreMultiplier) - damageCost
  return {
    mode: mode.id,
    outcome,
    hard: outcome === 'caught' && s.hard,
    cause: s.cause,
    score,
    parts,
    damage: s.damage.slice(),
    damageCost,
    closingSpeed: s.endVertical,
    horizontalSpeed: s.endHorizontal,
    tiltDeg: s.endTilt,
    catchTilt: s.hugTilt,
    along: s.endAlong,
    across: s.endAcross,
    closest: s.closest,
    armMargin: s.hugMargin > 0 ? s.hugMargin : 0,
    fuelLeft,
    flightSeconds: s.t,
  }
}
