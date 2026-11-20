/**
 * First Tracks rover sim: a skid-steer rover driven through signal delay.
 *
 * Fixed 60 Hz steps. Each step takes the player's input for that instant,
 * queues it, and applies the input given `uplink` seconds earlier. The
 * leaderboard re-drives a recorded input tape through this same code, so the
 * sim is deterministic across engines: only + - * /, Math.sqrt and the trig in
 * lib/touchdown/detmath.ts. Inputs are whole numbers -127..127 (the tape's
 * quantisation), so the browser and the server see the same values.
 *
 * Dependency-free apart from the site and trig helpers.
 */
import { dcos, dsin } from '@/lib/touchdown/detmath'
import type { ModeConfig } from './modes'
import {
  BODY,
  BUMP_MIN,
  cellKey,
  cellOf,
  clamp,
  COLL_R,
  DECK,
  DECK_Y,
  HALF_L,
  HALF_W,
  inRect,
  RAMP,
  RAMP_FOOT,
  CLEAR,
  HOLD_SECONDS,
  KIND_COUNT,
  type Rock,
  START_X,
  START_Z,
  TARGET_RING,
  WHEEL_R,
  WORLD,
  type Site,
} from './site'

export const STEP_HZ = 60
export const DT = 1 / STEP_HZ

/** m/s flat out; reverse is 60% of it. */
export const VMAX = 1.0
/** rad/s of skid steer. */
export const TURN = 0.55
/** tan of the roll (25°) and pitch (33°) the rover tips at. */
export const TIP_ROLL_TAN = 0.4663076581549986
export const TIP_PITCH_TAN = 0.6494075931975106
/** Steps the rover may stay past a tip limit before it goes over. */
const TIP_STEPS = 12
/** Steps the rover must hold still in a target's ring for its job. */
export function holdSteps(kind: keyof typeof HOLD_SECONDS): number {
  return Math.round(HOLD_SECONDS[kind] * STEP_HZ)
}

/**
 * Seconds on the clock when the rover leaves the lander: the day's whole
 * window (the mode's multiple of the site's par time) less every bonus the
 * targets will pay back.
 */
export function windowSecondsFor(site: Site, mode: ModeConfig): number {
  if (!(site.parSeconds > 0)) return mode.windowSeconds
  const bonuses = KIND_COUNT.image * mode.bonusSeconds.image + KIND_COUNT.rock * mode.bonusSeconds.rock + KIND_COUNT.ice * mode.bonusSeconds.ice
  const window = Math.round(mode.clockFactor * site.parSeconds - bonuses)
  return window < 25 ? 25 : window
}
/** Count a hit. In plot-and-send it also burns time off the clock. */
function countBump(s: Sim): void {
  s.bumps += 1
  if (s.mode.plan && s.off) s.windowEnd -= Math.round(s.mode.plan.hitSeconds * STEP_HZ)
}

/** Below this speed the rover counts as stopped for imaging, m/s. */
export const STILL_SPEED = 0.06
/** The prize distance: metres under own power after fully leaving the lander. */
export const PRIZE_METRES = 10
/**
 * The clock does not run on the lander, but a run cannot last forever: a tape
 * has a fixed maximum length. Three minutes without leaving the deck ends it.
 */
export const EGRESS_LIMIT_STEPS = STEP_HZ * 180

// Battery, in arbitrary units. A reasonable run uses about half.
export const BATTERY = 450
export const E_IDLE = 0.6
export const E_METRE = 1.0
export const E_CLIMB = 4
export const E_SPIN = 1.6
export const E_ROLL_TURN = 0.3
export const E_START = 1.5
export const E_STALL = 2.0
/** Plan mode: radians of unseen heading drift per metre where the regolith is loosest. */
export const YAW_SLIP = 0.012
/** Plan mode: metres slid downhill per metre driven, per unit of cross-slope. */
export const SIDE_SLIP = 0.6
/** Per metre driven with a wheel up on a rock, at the full clearance height. */
export const E_BUMP = 2.5
/** Share of its speed the rover loses climbing a rock as tall as its clearance. */
export const BUMP_DRAG = 0.6

export type Outcome =
  /** Every target imaged. */
  | 'complete'
  /** The comms window closed with the rover still rolling. */
  | 'window'
  | 'flat'
  | 'stuck'
  | 'tipped'
  /** Went over the edge of the deck or the ramp. */
  | 'fell'
  /** Never left the lander. */
  | 'parked'

export type Leg = {
  /** Where the leg started: the ramp foot, or the previous target's centre. */
  from: [number, number]
  /** Index of the target it ended at. */
  target: number
  metres: number
  energy: number
  /** m from the ring's centre the rover stopped. */
  off: number
}

export type SimEventKind = 'bump-lander' | 'bump-rock' | 'bump-boulder' | 'jolt' | 'egress' | 'imaged' | 'ten' | 'end'
export type SimEvent = { step: number; kind: SimEventKind; target?: number }

export type Sim = {
  site: Site
  mode: ModeConfig
  /** Steps taken. Time is steps * DT. */
  steps: number
  x: number
  z: number
  /** Heading, radians: forward is (sin h, cos h). */
  h: number
  v: number
  y: number
  /** tan of pitch (nose up positive) and of roll (right side up positive). */
  pitchTan: number
  rollTan: number
  /** Wheel rotation, radians (for the scene). */
  wheel: number
  /** Metres driven since leaving the lander. */
  odo: number
  /** Fully off the lander: all four wheels on the regolith. */
  off: boolean
  sink: number
  tipSteps: number
  energy: number
  outcome: Outcome | null
  endStep: number
  /** Step the clock started, and the step it runs out. */
  clockStart: number
  windowEnd: number
  /** Seconds left on the clock when the last target was imaged. */
  timeLeft: number
  imaged: boolean[]
  hold: number[]
  legs: Leg[]
  legFrom: [number, number]
  legOdo: number
  legEnergy: number
  /** Where the rover was when it passed the prize distance. */
  tenAt: [number, number] | null
  bumps: number
  lastBump: number
  /** Height of the tallest small rock under a wheel right now, m. */
  rockUnder: number
  /** Plan mode: heading the regolith has turned the rover by, unseen by its odometry, radians. */
  slipH: number
  /** Small rocks driven over. */
  jolts: number
  onRock: boolean
  /** Commands in flight: a ring of `delay` inputs, oldest at `head`. */
  delay: number
  queueTh: Int8Array
  queueSt: Int8Array
  head: number
  /** The command applied on the latest step. */
  th: number
  st: number
  events: SimEvent[]
}

export function createSim(site: Site, mode: ModeConfig): Sim {
  const delay = Math.max(1, Math.round(mode.uplink * STEP_HZ))
  const sim: Sim = {
    site,
    mode,
    steps: 0,
    x: START_X,
    z: START_Z,
    h: site.startHeading,
    v: 0,
    y: DECK_Y,
    pitchTan: 0,
    rollTan: 0,
    wheel: 0,
    odo: 0,
    off: false,
    sink: 0,
    tipSteps: 0,
    energy: 0,
    outcome: null,
    endStep: 0,
    clockStart: 0,
    windowEnd: 0,
    timeLeft: 0,
    imaged: site.targets.map(() => false),
    hold: site.targets.map(() => 0),
    legs: [],
    legFrom: [RAMP_FOOT[0], RAMP_FOOT[1]],
    legOdo: 0,
    legEnergy: 0,
    tenAt: null,
    bumps: 0,
    lastBump: -1000,
    rockUnder: 0,
    slipH: 0,
    jolts: 0,
    onRock: false,
    delay,
    queueTh: new Int8Array(delay),
    queueSt: new Int8Array(delay),
    head: 0,
    th: 0,
    st: 0,
    events: [],
  }
  settle(sim)
  return sim
}

/** Height the wheels ride on: the lander's deck and ramp until the rover is off them. */
export function driveHeight(site: Site, off: boolean, x: number, z: number): number {
  const g = site.ground(x, z)
  if (off) return g
  let l = -1
  if (inRect(DECK, x, z)) l = DECK_Y
  else if (inRect(RAMP, x, z)) l = DECK_Y * (1 - (z - RAMP.z0) / (RAMP.z1 - RAMP.z0))
  return l > g ? l : g
}

/** Half a wheel's width: a rock that near a wheel's centre line is under the wheel. */
const WHEEL_REACH = 0.08
const near: Rock[] = []

/** Sit the body on its four wheels, each lifted by any small rock it is riding over. */
function settle(s: Sim): void {
  const fx = dsin(s.h)
  const fz = dcos(s.h)
  const rx = -fz
  const rz = fx
  // Small rocks close enough to matter, gathered once for all four wheels.
  near.length = 0
  if (s.off) {
    const cx = cellOf(s.x)
    const cz = cellOf(s.z)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = s.site.bumps.get(cellKey(cx + i, cz + j))
        if (!list) continue
        for (let k = 0; k < list.length; k++) {
          const dx = list[k].x - s.x
          const dz = list[k].z - s.z
          if (dx * dx + dz * dz < 1.3 * 1.3) near.push(list[k])
        }
      }
    }
  }
  let under = 0
  const at = (a: number, b: number) => {
    const wx = s.x + fx * a + rx * b
    const wz = s.z + fz * a + rz * b
    let lift = 0
    for (let k = 0; k < near.length; k++) {
      const rock = near[k]
      const reach = rock.r + WHEEL_REACH
      const dx = wx - rock.x
      const dz = wz - rock.z
      const d2 = dx * dx + dz * dz
      if (d2 >= reach * reach) continue
      const up = rock.h * (1 - d2 / (reach * reach))
      if (up > lift) lift = up
    }
    if (lift > under) under = lift
    return driveHeight(s.site, s.off, wx, wz) + lift
  }
  const fr = at(HALF_L, HALF_W)
  const fl = at(HALF_L, -HALF_W)
  const br = at(-HALF_L, HALF_W)
  const bl = at(-HALF_L, -HALF_W)
  s.rockUnder = under
  s.y = (fr + fl + br + bl) / 4
  s.pitchTan = (fr + fl - (br + bl)) / (4 * HALF_L)
  s.rollTan = (fr + br - (fl + bl)) / (4 * HALF_W)
}

function end(s: Sim, outcome: Outcome, live: boolean): void {
  s.outcome = outcome
  s.endStep = s.steps
  if (live) s.events.push({ step: s.steps, kind: 'end' })
}

/**
 * One step with the command that has ARRIVED (th, st in -1..1). `live` false is
 * the ghost's look-ahead: it moves the rover but images nothing and logs nothing.
 */
export function stepApplied(s: Sim, th: number, st: number, live: boolean): void {
  if (s.outcome) return
  s.steps++
  s.th = th
  s.st = st
  const site = s.site
  const v0 = s.v
  const y0 = s.y
  const fx0 = dsin(s.h)
  const fz0 = dcos(s.h)
  const soft = s.off ? site.softAt(s.x, s.z) : 0
  const e = 0.4
  const grade = (driveHeight(site, s.off, s.x + fx0 * e, s.z + fz0 * e) - driveHeight(site, s.off, s.x - fx0 * e, s.z - fz0 * e)) / (2 * e)
  let target = th >= 0 ? th * VMAX : th * VMAX * 0.6
  const climb = target > 0 ? grade : target < 0 ? -grade : 0
  if (climb > 0) target *= clamp(1 - climb * 1.6, 0.2, 1)
  target *= (1 - 0.5 * soft) * (1 - 0.6 * s.sink)
  // A wheel up on a rock: the rover labours over it.
  const rockWas = s.rockUnder
  if (rockWas > 0) target *= 1 - BUMP_DRAG * (rockWas > CLEAR ? 1 : rockWas / CLEAR)
  const accel = (target < 0 ? -target : target) > (s.v < 0 ? -s.v : s.v) ? 0.9 : 1.6
  s.v += clamp(target - s.v, -accel * DT, accel * DT)
  s.h -= st * TURN * (1 - 0.3 * soft) * DT
  const speed = s.v < 0 ? -s.v : s.v
  // Plan mode: loose regolith scrubs the heading round as the wheels turn, and
  // a cross-slope carries the rover downhill. Neither shows in wheel odometry.
  let slideX = 0
  let slideZ = 0
  if (s.mode.plan && s.off) {
    const k = s.mode.plan.slip
    const ph = site.startHeading * 3
    const field = dsin(s.x * 0.61 + ph) * dcos(s.z * 0.47 - ph) + 0.5 * dsin((s.x + s.z) * 0.23 + ph)
    const yaw = k * field * YAW_SLIP * (1 + 6 * soft) * speed * DT
    s.h += yaw
    s.slipH += yaw
    // Roll positive is right side up: it slides to its left.
    const side = -s.rollTan * k * SIDE_SLIP * speed * DT
    slideX = -fz0 * side
    slideZ = fx0 * side
  }
  const fx = dsin(s.h)
  const fz = dcos(s.h)
  let nx = s.x + fx * s.v * DT + slideX
  let nz = s.z + fz * s.v * DT + slideZ

  // The lander itself. On the deck only the descent stage behind it blocks; on
  // the ground the whole lander does.
  const blocked = s.off ? inRect(DECK, nx, nz, 0.55) || inRect(BODY, nx, nz, 0.55) || inRect(RAMP, nx, nz, 0) : inRect(BODY, nx, nz, 0.55)
  if (blocked || nx > WORLD || nx < -WORLD || nz > WORLD || nz < -WORLD) {
    nx = s.x
    nz = s.z
    if (live && speed > 0.15 && s.steps - s.lastBump > 48) {
      countBump(s)
      s.lastBump = s.steps
      s.events.push({ step: s.steps, kind: 'bump-lander' })
    }
    s.v = 0
  }
  // Rocks taller than the wheels stop the rover dead.
  const cx = cellOf(nx)
  const cz = cellOf(nz)
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = site.hazards.get(cellKey(cx + i, cz + j))
      if (!list) continue
      for (let k = 0; k < list.length; k++) {
        const rock = list[k]
        const dx = nx - rock.x
        const dz = nz - rock.z
        const m = COLL_R + rock.r * 0.8
        const d2 = dx * dx + dz * dz
        if (d2 >= m * m) continue
        const d = Math.sqrt(d2)
        if (live && (s.v > 0.12 || s.v < -0.12) && s.steps - s.lastBump > 48) {
          countBump(s)
          s.lastBump = s.steps
          s.events.push({ step: s.steps, kind: rock.h > 0.6 ? 'bump-boulder' : 'bump-rock' })
        }
        s.v = 0
        const inv = d > 1e-9 ? 1 / d : 0
        nx = rock.x + dx * inv * m
        nz = rock.z + dz * inv * m
      }
    }
  }
  const stepLen = Math.sqrt((nx - s.x) * (nx - s.x) + (nz - s.z) * (nz - s.z))
  s.x = nx
  s.z = nz
  s.wheel += ((s.v < 0 ? -stepLen : stepLen) / WHEEL_R)
  if (s.off) s.odo += stepLen
  settle(s)

  const absSt = st < 0 ? -st : st
  const absTh = th < 0 ? -th : th
  const speedNow = s.v < 0 ? -s.v : s.v

  // Battery: avionics always, plus driving, climbing, scrubbing turns, every start, spinning wheels.
  if (s.off) {
    let de = E_IDLE * DT + stepLen * E_METRE * (1 + 2 * soft)
    if (s.y > y0) de += (s.y - y0) * E_CLIMB
    de += absSt * (speedNow < 0.15 ? E_SPIN : E_ROLL_TURN) * DT
    const gain = speedNow - (v0 < 0 ? -v0 : v0)
    if (gain > 0) de += gain * E_START
    if (absTh > 0.1 && speedNow < 0.05) de += E_STALL * DT
    if (s.rockUnder > 0) de += stepLen * E_BUMP * (s.rockUnder / CLEAR)
    s.energy += de
    if (s.energy >= BATTERY) {
      s.energy = BATTERY
      end(s, 'flat', live)
      return
    }
  }

  // Soft ground: the wheels sink, faster when turning, much faster when spinning in place. Reversing digs out.
  if (s.off && soft > 0.15) {
    if (th > 0.1) s.sink += soft * (0.045 + 0.12 * absSt + (speedNow < 0.1 ? 0.1 : 0)) * DT
    else if (th < -0.1) s.sink -= 0.2 * DT
    else s.sink -= 0.02 * DT
  } else s.sink -= 0.3 * DT
  s.sink = clamp(s.sink, 0, 1)
  if (s.sink >= 1) {
    end(s, 'stuck', live)
    return
  }

  // Tipping: cross-slope roll or pitch past the limit for a fifth of a second.
  if (s.rollTan > TIP_ROLL_TAN || s.rollTan < -TIP_ROLL_TAN || s.pitchTan > TIP_PITCH_TAN || s.pitchTan < -TIP_PITCH_TAN) {
    s.tipSteps++
    if (s.tipSteps > TIP_STEPS) {
      end(s, s.off ? 'tipped' : 'fell', live)
      return
    }
  } else s.tipSteps = 0

  // Egress: fully off means all four wheels on the regolith. The clock and the 10 m start here.
  if (!s.off) {
    const rx = -fz
    const rz = fx
    let on = false
    for (let c = 0; c < 4 && !on; c++) {
      const a = c < 2 ? HALF_L : -HALF_L
      const b = c % 2 === 0 ? HALF_W : -HALF_W
      const wx = s.x + fx * a + rx * b
      const wz = s.z + fz * a + rz * b
      if (inRect(DECK, wx, wz) || inRect(RAMP, wx, wz)) on = true
    }
    if (!on && s.y < 0.3) {
      s.off = true
      s.clockStart = s.steps
      s.windowEnd = s.steps + windowSecondsFor(site, s.mode) * STEP_HZ
      if (live) s.events.push({ step: s.steps, kind: 'egress' })
    } else if (live && s.steps >= EGRESS_LIMIT_STEPS) {
      end(s, 'parked', live)
      return
    }
  }
  if (!live || !s.off) return

  // Riding up onto a small rock: a jolt.
  if (s.rockUnder >= BUMP_MIN * 0.6) {
    if (!s.onRock && speedNow > 0.15) {
      s.jolts++
      s.events.push({ step: s.steps, kind: 'jolt' })
    }
    s.onRock = true
  } else if (s.rockUnder === 0) s.onRock = false

  // Science: stop inside a ring and hold still for a second.
  const targets = site.targets
  for (let i = 0; i < targets.length; i++) {
    if (s.imaged[i]) continue
    const t = targets[i]
    const dx = s.x - t.x
    const dz = s.z - t.z
    const d2 = dx * dx + dz * dz
    if (d2 < TARGET_RING * TARGET_RING && speedNow < STILL_SPEED) {
      s.hold[i]++
      if (s.hold[i] >= holdSteps(t.kind)) {
        s.imaged[i] = true
        s.windowEnd += Math.round(s.mode.bonusSeconds[t.kind] * STEP_HZ)
        s.legs.push({ from: s.legFrom, target: i, metres: s.odo - s.legOdo, energy: s.energy - s.legEnergy, off: Math.sqrt(d2) })
        s.legFrom = [t.x, t.z]
        s.legOdo = s.odo
        s.legEnergy = s.energy
        s.events.push({ step: s.steps, kind: 'imaged', target: i })
        if (s.legs.length === targets.length) {
          s.timeLeft = (s.windowEnd - s.steps) * DT
          end(s, 'complete', live)
          return
        }
      }
    } else s.hold[i] = 0
  }
  if (!s.tenAt && s.odo >= PRIZE_METRES) {
    s.tenAt = [s.x, s.z]
    s.events.push({ step: s.steps, kind: 'ten' })
  }
  if (s.steps >= s.windowEnd) end(s, 'window', live)
}

/** Whole-number input -127..127 from a -1..1 axis. */
export function toInput(v: number): number {
  return Math.round(clamp(v, -1, 1) * 127)
}

/**
 * One step of the game: queue the input given now (whole numbers -127..127)
 * and apply the one that has finished its trip to the Moon.
 */
export function stepSim(s: Sim, th: number, st: number): void {
  if (s.outcome) return
  const i = s.head
  const ath = s.queueTh[i] / 127
  const ast = s.queueSt[i] / 127
  s.queueTh[i] = th
  s.queueSt[i] = st
  s.head = (i + 1) % s.delay
  stepApplied(s, ath, ast, true)
}

/** Seconds left on the clock; the full window while still on the lander. */
export function clockLeft(s: Sim): number {
  if (!s.off) return windowSecondsFor(s.site, s.mode)
  const left = (s.windowEnd - (s.outcome ? s.endStep : s.steps)) * DT
  return left > 0 ? left : 0
}

/**
 * The ghost: where the rover will be once every command already in flight has
 * arrived. Runs the queued commands on a copy; the real sim is untouched.
 */
export function ghostOf(s: Sim): Sim {
  const g: Sim = { ...s }
  for (let k = 0; k < s.delay && !g.outcome; k++) {
    const i = (s.head + k) % s.delay
    stepApplied(g, s.queueTh[i] / 127, s.queueSt[i] / 127, false)
  }
  return g
}
