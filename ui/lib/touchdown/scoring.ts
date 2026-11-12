/**
 * Touchdown scoring.
 *
 * Points: softness 400 + accuracy 400 + bullseye 150 + fuel 200 + level 100 =
 * 1,250, times 1.25 in Pro, times the lander's CONDITION:
 *
 *   intact and upright            x1.0
 *   upright but damaged           x0.7   (a leg collapsed, or it is resting on its belly)
 *   tipped, still leaning         x0.4
 *   on its side                   x0.25
 *   upside down                   x0.1
 *   broken apart / never landed   x0
 *
 * So a marginal landing still earns something for being soft, close and
 * frugal, and only a break-up scores nothing. Any lander that reaches the
 * surface in one piece gets at least 50.
 *
 * Hitting Moon Base Zero costs BASE_DAMAGE_PENALTY per structure, taken off
 * after everything else, so a rampage through the base goes negative.
 *
 * Dependency-free: imported by the headless bot.
 */
import { TIPPED_TILT_DEG, type ModeId } from './modes'
import { distanceToTarget, tiltDeg, type Outcome, type Sim } from './physics'

/** Radius of the green ring. Centre inside it: full bullseye points. */
export const BULLSEYE_M = 5
/** Centre this far out, no footpad is in the ring any more: zero bullseye points. */
export const BULLSEYE_OUTER_M = BULLSEYE_M + 2.7
export const ACCURACY_RANGE_M = 90
export const BASE_DAMAGE_PENALTY = 150
export const BASE_DAMAGE_MAX = 10

export type FlightResult = {
  outcome: Outcome
  mode: ModeId
  score: number
  /** m from the target centre */
  distance: number
  /** m/s at first contact */
  touchdownSpeed: number
  /** 0..1 */
  fuelLeft: number
  tiltDeg: number
  flightSeconds: number
  bullseye: boolean
  /** Upright, but a leg collapsed or the hull is on the ground. */
  damaged: boolean
  /** 0..1 multiplier for the state the lander ended up in. */
  condition: number
  conditionLabel: string
  /** Moon Base Zero structures hit, and the points that cost. */
  baseDamage: number
  penalty: number
  parts: { softness: number; accuracy: number; bullseye: number; fuel: number; level: number }
}

export function isUpright(outcome: Outcome): boolean {
  return outcome === 'landed' || outcome === 'hard'
}

export function scoreFlight(sim: Sim): FlightResult {
  const outcome = sim.outcome ?? 'lost'
  const distance = distanceToTarget(sim)
  const tilt = tiltDeg(sim)
  const fuelLeft = sim.fuel / sim.mode.fuelSeconds
  const damaged = isUpright(outcome) && (sim.padBroken.some(Boolean) || sim.hullContacts > 0)

  let condition = 0
  let conditionLabel = 'Broke apart'
  if (outcome === 'landed' || (outcome === 'hard' && !damaged)) {
    condition = 1
    conditionLabel = 'Intact and upright'
  } else if (outcome === 'hard') {
    condition = 0.7
    conditionLabel = 'Upright, damaged'
  } else if (outcome === 'tipped') {
    condition = tilt < 50 ? 0.4 : 0.25
    conditionLabel = tilt < 50 ? 'Tipped, leaning' : 'On its side'
  } else if (outcome === 'inverted') {
    condition = 0.1
    conditionLabel = 'Upside down'
  } else if (outcome === 'lost') {
    conditionLabel = 'Never landed'
  }

  const parts = { softness: 0, accuracy: 0, bullseye: 0, fuel: 0, level: 0 }
  let score = 0
  if (condition > 0) {
    const v = sim.touchdownSpeed
    parts.softness = Math.round(400 * clamp01((sim.mode.legCollapseSpeed - v) / (sim.mode.legCollapseSpeed - 1)))
    parts.accuracy = Math.round(400 * clamp01(1 - distance / ACCURACY_RANGE_M) ** 1.5)
    parts.bullseye = Math.round(150 * clamp01((BULLSEYE_OUTER_M - distance) / (BULLSEYE_OUTER_M - BULLSEYE_M)))
    parts.fuel = Math.round(200 * clamp01(fuelLeft))
    parts.level = Math.round(100 * clamp01(1 - tilt / TIPPED_TILT_DEG))
    const sum = parts.softness + parts.accuracy + parts.bullseye + parts.fuel + parts.level
    score = Math.max(50, Math.round(sum * sim.mode.scoreMultiplier * condition))
  }
  const baseDamage = Math.min(BASE_DAMAGE_MAX, sim.baseDamage)
  const penalty = baseDamage * BASE_DAMAGE_PENALTY
  score -= penalty
  return {
    outcome,
    mode: sim.mode.id,
    score,
    distance,
    touchdownSpeed: sim.touchdownSpeed,
    fuelLeft,
    tiltDeg: tilt,
    flightSeconds: sim.t,
    bullseye: condition === 1 && distance < BULLSEYE_M,
    damaged,
    condition,
    conditionLabel,
    baseDamage,
    penalty,
    parts,
  }
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
