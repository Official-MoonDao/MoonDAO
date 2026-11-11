/**
 * Touchdown lander physics: one hand-rolled rigid body.
 *
 * 4 footpads + 26 hull points, each a spring-damper against the terrain and
 * boulders, with Coulomb friction. Tip-overs, cartwheels and gear collapse are
 * not scripted; they fall out of the contacts. Run `stepSim` at SUBSTEP_HZ.
 *
 * Units are SI with unit mass, so forces are accelerations.
 * Axes: +x is the approach direction, +y up, +z screen-right from the chase
 * camera. The body's thrust axis is body +y.
 *
 * Dependency-free: imported by the headless bot.
 */
import { LUNAR_G, TIPPED_TILT_DEG, type ModeConfig } from './modes'
import { contactAt, heightAt, MAP_SIZE, type Contact, type Terrain } from './terrain'

export const SUBSTEP_HZ = 480
export const SUBSTEP_DT = 1 / SUBSTEP_HZ

/** COM height above the bottom of the footpads. */
export const PAD_DROP = 1.7
const PAD_SPREAD = 1.9

// Principal moments of inertia per unit mass (m²), body frame.
const IX = 2.2
const IY = 2.6
const IZ = 2.2

/** Attitude thrusters: peak angular acceleration in free flight (rad/s²). */
const RCS_ALPHA = 1.3
/** ...and the fraction left once anything is touching the ground. They must
 * stay too weak to save a tip-over; the drama depends on it. */
const RCS_GROUND_FRACTION = 0.12

const PAD_K = 500
const PAD_C = 22
const PAD_MU = 0.9
const HULL_K = 900
const HULL_C = 20
const HULL_MU = 0.6
const SLIP_V = 0.02

export const POINT_COUNT = 30
/** Body-frame contact points. 0..3 are the footpads. */
export const POINTS = (() => {
  const p: number[] = []
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]) {
    p.push(sx * PAD_SPREAD, -PAD_DROP, sz * PAD_SPREAD)
  }
  const ring = (y: number, r: number, phase: number) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + phase
      p.push(Math.cos(a) * r, y, Math.sin(a) * r)
    }
  }
  ring(-0.9, 1.5, 0)
  ring(0.1, 1.75, Math.PI / 8)
  ring(1.1, 1.3, 0)
  p.push(0, -1.35, 0) // engine bell
  p.push(0, 1.9, 0) // antenna mast
  return new Float32Array(p)
})()

export type SimInput = {
  /** -1..1, positive tilts toward screen-right (+z) */
  x: number
  /** -1..1, positive tilts forward (+x); negative tilts back to brake */
  y: number
  burn: boolean
}

export type Outcome = 'landed' | 'hard' | 'tipped' | 'inverted' | 'crashed' | 'lost'

export type SimEvent =
  | { type: 'contact'; speed: number }
  | { type: 'legbreak'; leg: number; speed: number }
  | { type: 'hull'; speed: number }
  | { type: 'breakup'; speed: number }
  | { type: 'fuelout' }
  | { type: 'done'; outcome: Outcome }

export type Sim = {
  terrain: Terrain
  mode: ModeConfig
  t: number
  px: number
  py: number
  pz: number
  vx: number
  vy: number
  vz: number
  qw: number
  qx: number
  qy: number
  qz: number
  /** Angular velocity, world frame. */
  wx: number
  wy: number
  wz: number
  /** Seconds of burn left. */
  fuel: number
  burning: boolean
  padBroken: boolean[]
  inContact: Uint8Array
  padContacts: number
  hullContacts: number
  firstContactT: number
  /** COM speed at the first contact (m/s). The "0.8 m/s touchdown" number. */
  touchdownSpeed: number
  touchdownVertical: number
  restTimer: number
  airTimer: number
  /** Last commanded attitude-thruster acceleration (rad/s², world frame). Drives the RCS puffs. */
  rcsX: number
  rcsY: number
  rcsZ: number
  outcome: Outcome | null
  events: SimEvent[]
  /** Rotation matrix (row-major), refreshed every substep. */
  m: Float64Array
}

export function createSim(terrain: Terrain, mode: ModeConfig, lateralOffset = 0): Sim {
  const pitch = (-mode.startPitchDeg * Math.PI) / 180
  // Body-up leaning toward -x is a rotation about +z by +pitch magnitude.
  const half = -pitch / 2
  const sim: Sim = {
    terrain,
    mode,
    t: 0,
    px: terrain.target.x - mode.startDistance,
    py: terrain.target.y + mode.startAltitude,
    pz: terrain.target.z + lateralOffset,
    vx: mode.startHorizontalSpeed,
    vy: mode.startVerticalSpeed,
    vz: 0,
    qw: Math.cos(half),
    qx: 0,
    qy: 0,
    qz: Math.sin(half),
    wx: 0,
    wy: 0,
    wz: 0,
    fuel: mode.fuelSeconds,
    burning: false,
    padBroken: [false, false, false, false],
    inContact: new Uint8Array(POINT_COUNT),
    padContacts: 0,
    hullContacts: 0,
    firstContactT: -1,
    touchdownSpeed: 0,
    touchdownVertical: 0,
    restTimer: 0,
    airTimer: 0,
    rcsX: 0,
    rcsY: 0,
    rcsZ: 0,
    outcome: null,
    events: [],
    m: new Float64Array(9),
  }
  refreshMatrix(sim)
  return sim
}

function refreshMatrix(s: Sim) {
  const { qw: w, qx: x, qy: y, qz: z, m } = s
  m[0] = 1 - 2 * (y * y + z * z)
  m[1] = 2 * (x * y - w * z)
  m[2] = 2 * (x * z + w * y)
  m[3] = 2 * (x * y + w * z)
  m[4] = 1 - 2 * (x * x + z * z)
  m[5] = 2 * (y * z - w * x)
  m[6] = 2 * (x * z - w * y)
  m[7] = 2 * (y * z + w * x)
  m[8] = 1 - 2 * (x * x + y * y)
}

/** Degrees between the lander's thrust axis and straight up. */
export function tiltDeg(s: Sim): number {
  return (Math.acos(Math.min(1, Math.max(-1, s.m[4]))) * 180) / Math.PI
}

/** Radar altitude: lowest footpad above the ground directly below the COM. */
export function altitudeAGL(s: Sim): number {
  return s.py - PAD_DROP - heightAt(s.terrain, s.px, s.pz)
}

export function distanceToTarget(s: Sim): number {
  return Math.hypot(s.px - s.terrain.target.x, s.pz - s.terrain.target.z)
}

const contact: Contact = { depth: 0, nx: 0, ny: 1, nz: 0, boulder: false }

export function stepSim(s: Sim, input: SimInput, dt: number = SUBSTEP_DT): void {
  if (s.outcome) return
  const mode = s.mode
  const m = s.m
  s.t += dt

  // --- Forces -----------------------------------------------------------------
  let fx = 0
  let fy = -LUNAR_G
  let fz = 0
  let tx = 0
  let ty = 0
  let tz = 0

  const burning = input.burn && s.fuel > 0
  if (burning) {
    fx += m[1] * mode.engineAccel
    fy += m[4] * mode.engineAccel
    fz += m[7] * mode.engineAccel
    s.fuel -= dt
    if (s.fuel <= 0) {
      s.fuel = 0
      s.events.push({ type: 'fuelout' })
    }
  }
  s.burning = burning

  // --- Contacts ---------------------------------------------------------------
  let padContacts = 0
  let hullContacts = 0
  for (let i = 0; i < POINT_COUNT; i++) {
    const isPad = i < 4
    if (isPad && s.padBroken[i]) {
      s.inContact[i] = 0
      continue
    }
    const bx = POINTS[i * 3]
    const by = POINTS[i * 3 + 1]
    const bz = POINTS[i * 3 + 2]
    const rx = m[0] * bx + m[1] * by + m[2] * bz
    const ry = m[3] * bx + m[4] * by + m[5] * bz
    const rz = m[6] * bx + m[7] * by + m[8] * bz
    if (!contactAt(s.terrain, s.px + rx, s.py + ry, s.pz + rz, contact)) {
      s.inContact[i] = 0
      continue
    }
    // Point velocity = v + w × r
    const pvx = s.vx + (s.wy * rz - s.wz * ry)
    const pvy = s.vy + (s.wz * rx - s.wx * rz)
    const pvz = s.vz + (s.wx * ry - s.wy * rx)
    const vn = pvx * contact.nx + pvy * contact.ny + pvz * contact.nz

    if (!s.inContact[i]) {
      s.inContact[i] = 1
      const impact = -vn
      if (s.firstContactT < 0) {
        s.firstContactT = s.t
        s.touchdownSpeed = Math.hypot(s.vx, s.vy, s.vz)
        s.touchdownVertical = -s.vy
        s.events.push({ type: 'contact', speed: s.touchdownSpeed })
      }
      if (isPad) {
        if (impact > mode.legCollapseSpeed * 2) {
          finish(s, 'crashed', impact)
          return
        }
        if (impact > mode.legCollapseSpeed) {
          s.padBroken[i] = true
          s.inContact[i] = 0
          s.events.push({ type: 'legbreak', leg: i, speed: impact })
          // A collapsing strut soaks up part of the blow.
          s.vx *= 0.9
          s.vy *= 0.75
          s.vz *= 0.9
          continue
        }
      } else {
        if (impact > mode.breakupSpeed) {
          finish(s, 'crashed', impact)
          return
        }
        if (impact > 0.6) s.events.push({ type: 'hull', speed: impact })
      }
    }

    if (isPad) padContacts++
    else hullContacts++

    const k = isPad ? PAD_K : HULL_K
    const c = isPad ? PAD_C : HULL_C
    const mu = isPad ? PAD_MU : HULL_MU
    let fn = k * contact.depth - c * vn
    if (fn < 0) fn = 0
    // Tangential (friction), regularised near zero slip.
    const tvx = pvx - vn * contact.nx
    const tvy = pvy - vn * contact.ny
    const tvz = pvz - vn * contact.nz
    const tv = Math.sqrt(tvx * tvx + tvy * tvy + tvz * tvz)
    const ft = (mu * fn) / Math.max(tv, SLIP_V)
    const cfx = fn * contact.nx - ft * tvx
    const cfy = fn * contact.ny - ft * tvy
    const cfz = fn * contact.nz - ft * tvz
    fx += cfx
    fy += cfy
    fz += cfz
    tx += ry * cfz - rz * cfy
    ty += rz * cfx - rx * cfz
    tz += rx * cfy - ry * cfx
  }
  s.padContacts = padContacts
  s.hullContacts = hullContacts
  const grounded = padContacts + hullContacts > 0

  // --- Attitude control ---------------------------------------------------------
  let ax = 0
  let ay = 0
  let az = 0
  // Yaw hold: keep the body's +x pointing down-track.
  const yaw = Math.atan2(-m[6], m[0])
  ay = -4 * yaw - 3.5 * s.wy
  if (mode.control === 'angle') {
    const max = (mode.maxTiltDeg * Math.PI) / 180
    const dxu = Math.tan(clamp(input.y, -1, 1) * max)
    const dzu = Math.tan(clamp(input.x, -1, 1) * max)
    const inv = 1 / Math.sqrt(dxu * dxu + 1 + dzu * dzu)
    const ux = dxu * inv
    const uy = inv
    const uz = dzu * inv
    // Error axis = up × desiredUp (world)
    const ex = m[4] * uz - m[7] * uy
    const ez = m[1] * uy - m[4] * ux
    ax = 6 * ex - 4.5 * s.wx
    az = 6 * ez - 4.5 * s.wz
  } else {
    const rate = (mode.maxRateDeg * Math.PI) / 180
    ax = 5 * (clamp(input.x, -1, 1) * rate - s.wx)
    az = 5 * (-clamp(input.y, -1, 1) * rate - s.wz)
  }
  const limit = RCS_ALPHA * (grounded ? RCS_GROUND_FRACTION : 1)
  const mag = Math.sqrt(ax * ax + ay * ay + az * az)
  if (mag > limit) {
    const k = limit / mag
    ax *= k
    ay *= k
    az *= k
  }
  s.rcsX = ax
  s.rcsY = ay
  s.rcsZ = az
  // Commanded angular accelerations become torques (isotropic approximation).
  tx += ax * IX
  ty += ay * IY
  tz += az * IZ

  // --- Integrate (semi-implicit Euler) -------------------------------------------
  s.vx += fx * dt
  s.vy += fy * dt
  s.vz += fz * dt
  s.px += s.vx * dt
  s.py += s.vy * dt
  s.pz += s.vz * dt

  // Angular: to body frame, Euler's equations, back to world.
  const wbx = m[0] * s.wx + m[3] * s.wy + m[6] * s.wz
  const wby = m[1] * s.wx + m[4] * s.wy + m[7] * s.wz
  const wbz = m[2] * s.wx + m[5] * s.wy + m[8] * s.wz
  const tbx = m[0] * tx + m[3] * ty + m[6] * tz
  const tby = m[1] * tx + m[4] * ty + m[7] * tz
  const tbz = m[2] * tx + m[5] * ty + m[8] * tz
  const nbx = wbx + ((tbx - (IZ - IY) * wby * wbz) / IX) * dt
  const nby = wby + ((tby - (IX - IZ) * wbz * wbx) / IY) * dt
  const nbz = wbz + ((tbz - (IY - IX) * wbx * wby) / IZ) * dt
  s.wx = m[0] * nbx + m[1] * nby + m[2] * nbz
  s.wy = m[3] * nbx + m[4] * nby + m[5] * nbz
  s.wz = m[6] * nbx + m[7] * nby + m[8] * nbz

  // q += 0.5 * (0, w) * q * dt
  const { qw, qx, qy, qz } = s
  const hx = s.wx * dt * 0.5
  const hy = s.wy * dt * 0.5
  const hz = s.wz * dt * 0.5
  let nw = qw - hx * qx - hy * qy - hz * qz
  let nx = qx + hx * qw + hy * qz - hz * qy
  let ny = qy + hy * qw + hz * qx - hx * qz
  let nz = qz + hz * qw + hx * qy - hy * qx
  const qn = 1 / Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz)
  nw *= qn
  nx *= qn
  ny *= qn
  nz *= qn
  s.qw = nw
  s.qx = nx
  s.qy = ny
  s.qz = nz
  refreshMatrix(s)

  // --- End conditions --------------------------------------------------------------
  const edge = MAP_SIZE / 2 + 150
  if (Math.abs(s.px) > edge || Math.abs(s.pz) > edge || s.py > 2500) {
    finish(s, 'lost', 0)
    return
  }
  if (s.firstContactT >= 0) {
    const speed = Math.hypot(s.vx, s.vy, s.vz)
    const spin = Math.hypot(s.wx, s.wy, s.wz)
    if (grounded) {
      s.airTimer = 0
      if (speed < 0.08 && spin < 0.06 && !burning) s.restTimer += dt
      else s.restTimer = 0
    } else {
      s.restTimer = 0
      s.airTimer += dt
    }
    if (s.restTimer > 0.8 || s.t - s.firstContactT > 25) {
      const tilt = tiltDeg(s)
      let outcome: Outcome
      // Upright is upright, even resting on a collapsed leg or its belly: that
      // is a damaged but possibly usable lander, not a tip-over.
      if (tilt > 120) outcome = 'inverted'
      else if (tilt > TIPPED_TILT_DEG) outcome = 'tipped'
      else if (s.touchdownSpeed > 3 || hullContacts > 0 || s.padBroken.some(Boolean)) outcome = 'hard'
      else outcome = 'landed'
      finish(s, outcome, 0)
    }
  }
}

function finish(s: Sim, outcome: Outcome, speed: number) {
  s.outcome = outcome
  s.burning = false
  if (outcome === 'crashed') s.events.push({ type: 'breakup', speed })
  s.events.push({ type: 'done', outcome })
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
