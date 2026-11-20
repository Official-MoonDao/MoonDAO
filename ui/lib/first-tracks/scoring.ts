/**
 * First Tracks scoring. Hard to max: every figure is a sliding scale that
 * falls fastest close to perfect, with no "good enough" band.
 *
 *   targets  400  25 for imaging regolith, 50 for a boulder's spectrum, 75
 *                 for an ice core from a crater floor (three, two and three a
 *                 day): 30% for doing the job + 70% for how close to the
 *                 ring's centre the rover stopped
 *   route    300  shared over all 8 legs: metres driven on each leg against
 *                 that leg's hidden par route; 30% over par scores nothing
 *   battery  300  shared over all 8 legs: energy used on each leg against a
 *                 perfect driver's on par; double scores nothing
 *   time     2 a second left on the clock, only if all 8 targets are imaged
 *
 * Legs never driven earn no route or battery points. Then the rover's
 * condition (rolling x1, battery flat x0.8, stuck x0.6, tipped x0.25, fell off
 * the lander x0.1), then Pro x1.25.
 *
 * Leaving the lander and the first 10 m are milestones, not points.
 *
 * The player is never shown par: only a one-word grade per figure.
 *
 * Runs on the server in the leaderboard replay: square roots only, never
 * Math.pow, so every engine rounds the same way.
 */
import type { ModeId } from './modes'
import { parEnergy, parPath, pathLength } from './par'
import { BATTERY, DT, PRIZE_METRES, type Outcome, type Sim } from './sim'
import { clamp, HOLD_SECONDS, KIND_COUNT, N_TARGETS, TARGET_RING, type TargetKind } from './site'

export const KIND_POINTS: Record<TargetKind, number> = { image: 25, rock: 50, ice: 75 }
export const TARGET_POINTS = KIND_POINTS.image * KIND_COUNT.image + KIND_POINTS.rock * KIND_COUNT.rock + KIND_POINTS.ice * KIND_COUNT.ice
/** Share of a target's points for imaging it at all; the rest is for centring. */
export const IMAGED_SHARE = 0.3
export const ROUTE_POINTS = 300
export const BATTERY_POINTS = 300
export const TIME_POINTS_PER_SECOND = 2
/** Share over par at which a leg's route, and its battery, score nothing. */
export const ROUTE_LIMIT = 0.3
export const BATTERY_LIMIT = 1.0

export const CONDITION: Record<Outcome, number> = { complete: 1, window: 1, parked: 1, flat: 0.8, stuck: 0.6, tipped: 0.25, fell: 0.1 }

export type Grade = 'Near perfect' | 'Tidy' | 'Room to improve' | 'Wasteful' | ''

export type RunResult = {
  mission: number
  mode: ModeId
  outcome: Outcome
  score: number
  /** Points before the condition and mode multipliers. */
  parts: { targets: number; route: number; battery: number; time: number }
  grades: { targets: Grade; route: Grade; battery: Grade }
  condition: number
  /** Targets imaged, of N_TARGETS. */
  imaged: number
  /** How many of each job were done. */
  done: Record<TargetKind, number>
  /** Fully left the lander. */
  off: boolean
  /** Metres driven after leaving the lander. */
  metres: number
  /** Drove the prize distance. */
  firstTracks: boolean
  /** Seconds left when the last target was imaged (0 unless all were). */
  timeLeft: number
  /** Share of the battery left, 0..1. */
  batteryLeft: number
  /** Seconds on the clock from leaving the lander to the end. */
  driveSeconds: number
  bumps: number
  /**
   * Plot-and-send only: uplinks sent, the most jobs one of them finished, and
   * the combo points they earned (already in `score`).
   */
  uplink?: { sends: number; best: number; bonus: number; /** Net points from what the targets turned out to hold. */ finds: number }
}

/** 1 at no excess, 0 at `limit`, falling as the square root: steepest right next to perfect. */
const rootCurve = (excess: number, limit: number) => 1 - Math.sqrt(clamp(excess / limit, 0, 1))
/** The same with exponent 3/4, for centring. */
const centreCurve = (off: number) => {
  const u = clamp(off / TARGET_RING, 0, 1)
  const r = Math.sqrt(u)
  return 1 - r * Math.sqrt(r)
}

function grade(quality: number, legs: number): Grade {
  if (!legs) return ''
  return quality >= 0.9 ? 'Near perfect' : quality >= 0.7 ? 'Tidy' : quality >= 0.45 ? 'Room to improve' : 'Wasteful'
}

export function scoreRun(s: Sim): RunResult {
  const site = s.site
  const perLeg = ROUTE_POINTS / N_TARGETS
  const perLegBattery = BATTERY_POINTS / N_TARGETS
  let targets = 0
  let route = 0
  let battery = 0
  let qT = 0
  let qR = 0
  let qB = 0
  let heading: number | null = 0
  for (const leg of s.legs) {
    const t = site.targets[leg.target]
    const c = centreCurve(leg.off)
    targets += KIND_POINTS[t.kind] * (IMAGED_SHARE + (1 - IMAGED_SHARE) * c)
    qT += c
    const path = parPath(site, leg.from[0], leg.from[1], t.x, t.z)
    const len = pathLength(path)
    const par = parEnergy(site, path, heading, HOLD_SECONDS[t.kind])
    heading = par.heading
    const r = len > 0 ? rootCurve(leg.metres / len - 1, ROUTE_LIMIT) : 0
    const b = par.energy > 0 ? rootCurve(leg.energy / par.energy - 1, BATTERY_LIMIT) : 0
    route += perLeg * r
    battery += perLegBattery * b
    qR += r
    qB += b
  }
  const n = s.legs.length
  const outcome: Outcome = s.outcome ?? 'window'
  const parts = {
    targets: Math.round(targets),
    route: Math.round(route),
    battery: Math.round(battery),
    time: outcome === 'complete' ? Math.round(s.timeLeft * TIME_POINTS_PER_SECOND) : 0,
  }
  const condition = CONDITION[outcome]
  const sum = parts.targets + parts.route + parts.battery + parts.time
  const endStep = s.outcome ? s.endStep : s.steps
  return {
    mission: site.mission,
    mode: s.mode.id,
    outcome,
    score: Math.round(sum * condition * s.mode.scoreMultiplier),
    parts,
    grades: { targets: grade(n ? qT / n : 0, n), route: grade(n ? qR / n : 0, n), battery: grade(n ? qB / n : 0, n) },
    condition,
    imaged: n,
    done: {
      image: s.legs.filter((leg) => site.targets[leg.target].kind === 'image').length,
      rock: s.legs.filter((leg) => site.targets[leg.target].kind === 'rock').length,
      ice: s.legs.filter((leg) => site.targets[leg.target].kind === 'ice').length,
    },
    off: s.off,
    metres: s.odo,
    firstTracks: s.odo >= PRIZE_METRES,
    timeLeft: outcome === 'complete' ? s.timeLeft : 0,
    batteryLeft: clamp(1 - s.energy / BATTERY, 0, 1),
    driveSeconds: s.off ? (endStep - s.clockStart) * DT : 0,
    bumps: s.bumps,
  }
}

/**
 * A ceiling no honest run can pass, per mode multiplier: every figure maxed and
 * a clock no site's window reaches. Only used to bound what the board accepts.
 */
export function maxScore(multiplier: number): number {
  return Math.ceil((TARGET_POINTS + ROUTE_POINTS + BATTERY_POINTS + 400 * TIME_POINTS_PER_SECOND) * multiplier)
}
