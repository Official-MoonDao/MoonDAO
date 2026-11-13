/**
 * Catch flight physics: one hand-rolled rigid body under Earth gravity, with
 * air drag and the day's wind, landing engines that thrust along the hull,
 * and the tower's two catch arms.
 *
 * The ship is a tall, heavy cylinder that flies tail-first and stays near
 * vertical; tilting it points the thrust, which is the only way to move
 * sideways or brake. A catch is not scripted: the arms swing in until they
 * meet the hull, and the ship is caught when its two catch pins come down on
 * the arms' rails. Close the arms too early and the aft flaps land on them;
 * too late and the pins have already gone past.
 *
 * Units are SI with unit mass, so forces are accelerations.
 * Axes: x east (the approach direction), y up, z south (screen-right from the
 * chase camera). Body frame: y along the hull, x toward the tiled belly, z
 * through the catch pins. The origin of the body frame is the centre of mass.
 *
 * The step uses only exactly-defined arithmetic (see detmath.ts), so a
 * recorded flight replays identically on the server.
 *
 * Dependency-free: imported by the headless bot.
 */
import { datan2, dcos, dsin, dtan } from '@/lib/touchdown/detmath'
import type { Conditions } from './conditions'
import { ARMS, MOUNT, PAD1, PAD2, SHIP, TOWER } from './layout'
import { EARTH_G, type ModeConfig } from './modes'

export const SUBSTEP_HZ = 240
export const SUBSTEP_DT = 1 / SUBSTEP_HZ

/** Centre of mass above the base: engines and header tanks keep it low. */
export const COM_Y = 20
/** Catch pins, measured from the centre of mass. */
export const PIN_Y = SHIP.catchY - COM_Y

// Principal moments of inertia per unit mass (m²): a 52 m cylinder.
const IX = 230
const IY = 12
const IZ = 230

/** Engine gimbal and thrusters: peak angular acceleration (rad/s²). */
const TURN_ALPHA = 1.1

/** Air: drag per unit mass, broadside and end-on (1/m). */
const DRAG_SIDE = 0.003
const DRAG_AXIAL = 0.0003

/** Arm pivots: both stand this far east of the catch point, either side of the centre line. */
export const PIVOT_X = PAD1.x + TOWER.catchDist - ARMS.pivotOut
export const PIVOT_Z = ARMS.pivotX
/** The sweet spot: where the pins should come to rest along the rails, and how
 * high above the rails they should be when the arms take hold. */
export const SWEET_X = PAD1.x + 6
export const SWEET_MARGIN = 3
/** The arms stop when their centre line is this far from the hull's axis. */
const HUG = SHIP.radius + 1.6
/** Half-thickness of an arm for collisions, and how far below the rail it counts. */
const ARM_RADIUS = 0.5
const ARM_DEPTH = 4

/** The straight coast the physics uses (the drawn waterline wanders a few metres either side). */
export function seaAt(x: number, z: number): boolean {
  return x > 395 + 0.05 * z
}

export type StructureId = 'tower' | 'arms' | 'mount' | 'tankfarm' | 'tower2' | 'booster' | 'mount2' | 'plant' | 'hopper' | 'highway'

/** Solid boxes a ship can fly into: [x0, x1, z0, z1, height]. */
export const COLLIDERS: { id: StructureId; box: [number, number, number, number, number] }[] = [
  { id: 'tower', box: [PAD1.x + 27, PAD1.x + 41, -7, 7, TOWER.height] },
  { id: 'mount', box: [PAD1.x - MOUNT.size / 2, PAD1.x + MOUNT.size / 2, -MOUNT.size / 2, MOUNT.size / 2, MOUNT.top] },
  { id: 'tower2', box: [PAD2.x - 7, PAD2.x + 7, PAD2.z - 41, PAD2.z - 27, TOWER.height] },
  { id: 'booster', box: [PAD2.x - 5, PAD2.x + 5, PAD2.z - 5, PAD2.z + 5, 102] },
  { id: 'mount2', box: [PAD2.x - 12, PAD2.x + 12, PAD2.z - 12, PAD2.z + 12, MOUNT.top] },
  { id: 'tankfarm', box: [-268, -40, -96, -52, 7] },
  { id: 'tankfarm', box: [-312, -262, -102, -84, 13] },
  { id: 'plant', box: [-250, -80, -124, -100, 8] },
  { id: 'hopper', box: [-305, -295, -267, -257, 18] },
]

/** Where a blast is measured to for each structure: [x, y, z]. */
export const BLAST_POINTS: Record<StructureId, [number, number, number]> = {
  tower: [PAD1.x + 34, 70, 0],
  arms: [PAD1.x + 8, PAD1.railY, 0],
  mount: [PAD1.x, 6, 0],
  tankfarm: [-160, 4, -74],
  tower2: [PAD2.x, 70, PAD2.z - 34],
  booster: [PAD2.x, 60, PAD2.z],
  mount2: [PAD2.x, 6, PAD2.z],
  plant: [-165, 4, -112],
  hopper: [-300, 9, -262],
  highway: [-110, 0, -140],
}

/** Hull and flap sample points in the body frame (catch pins are not among them). */
export const POINTS = (() => {
  const p: number[] = []
  const ring = (y: number, r: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      p.push(dcos(a) * r, y, dsin(a) * r)
    }
  }
  ring(-COM_Y, SHIP.radius, 8) // base
  ring(-8, SHIP.radius, 8)
  ring(6, SHIP.radius, 8)
  ring(SHIP.noseBase - COM_Y, SHIP.radius, 8)
  ring(24, 3.2, 4)
  p.push(0, SHIP.height - COM_Y, 0) // nose tip
  // Aft flaps reach out along the pin axis, low on the hull.
  for (const s of [-1, 1]) p.push(0, -COM_Y + 1, s * 10, 0, -COM_Y + 8, s * 10, 0, -COM_Y + 14, s * 6.5)
  // Forward flaps sit just above the pins.
  for (const s of [-1, 1]) p.push(0, 21, s * 7.8, 0, 26, s * 5.5)
  return new Float64Array(p)
})()
export const POINT_COUNT = POINTS.length / 3
/** First flap point: everything before it is hull. */
const FLAP_START = 8 * 4 + 4 + 1

export type SimInput = {
  /** -1..1, positive tilts toward screen-right (+z) */
  x: number
  /** -1..1, positive tilts forward (+x); negative tilts back to brake */
  y: number
  burn: boolean
  /** Pro: close the arms. */
  arms: boolean
}

export type Outcome = 'caught' | 'splashdown' | 'ditched' | 'crashed' | 'lost'
export type CrashCause = StructureId | 'ground' | 'sea' | 'flaps'

export type SimEvent =
  | { type: 'armsclosing' }
  | { type: 'hug' }
  | { type: 'missed' }
  | { type: 'pins'; speed: number }
  | { type: 'fuelout' }
  | { type: 'done'; outcome: Outcome }

export type Sim = {
  mode: ModeConfig
  conditions: Conditions
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
  /** Arm swing in radians: ARMS.openAngle fully open, 0 closed. North arm (z < 0), south arm. */
  armN: number
  armS: number
  armsClosing: boolean
  /** Each arm has met the hull and stopped. */
  hugN: boolean
  hugS: boolean
  /** Height of the pins above the rails when both arms first held the hull; negative means too late. */
  hugMargin: number
  /** The pins went past the rails with the arms not holding: this pass is a miss. */
  missed: boolean
  pinsSheared: boolean
  /** Closest the pin line has come to its resting place on the rails (m). */
  closest: number
  // Filled in when the flight ends.
  outcome: Outcome | null
  cause: CrashCause | null
  /** Speeds and attitude at the catch or at impact. */
  endVertical: number
  endHorizontal: number
  endTilt: number
  /** Offsets from the sweet spot, along the arms (+ toward the tower) and across them (m). */
  endAlong: number
  endAcross: number
  /** Structures the blast or the impact damaged. */
  damage: StructureId[]
  events: SimEvent[]
  /** Rotation matrix (row-major), refreshed every substep. */
  m: Float64Array
  rcsX: number
  rcsZ: number
}

export function createSim(mode: ModeConfig, conditions: Conditions): Sim {
  const pitch = (mode.startPitchDeg * Math.PI) / 180
  // Leaning back toward -x is a rotation about +z by +pitch.
  const half = pitch / 2
  const sim: Sim = {
    mode,
    conditions,
    t: 0,
    px: PAD1.x - mode.startDistance,
    py: mode.startAltitude,
    pz: PAD1.z + conditions.lateral,
    vx: mode.startHorizontalSpeed,
    vy: mode.startVerticalSpeed,
    vz: 0,
    qw: dcos(half),
    qx: 0,
    qy: 0,
    qz: dsin(half),
    wx: 0,
    wy: 0,
    wz: 0,
    fuel: mode.fuelSeconds,
    burning: false,
    armN: ARMS.openAngle,
    armS: ARMS.openAngle,
    armsClosing: false,
    hugN: false,
    hugS: false,
    hugMargin: 0,
    missed: false,
    pinsSheared: false,
    closest: 1e9,
    outcome: null,
    cause: null,
    endVertical: 0,
    endHorizontal: 0,
    endTilt: 0,
    endAlong: 0,
    endAcross: 0,
    damage: [],
    events: [],
    m: new Float64Array(9),
    rcsX: 0,
    rcsZ: 0,
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

/** Degrees between the hull axis and straight up. */
export function tiltDeg(s: Sim): number {
  return (Math.acos(Math.min(1, Math.max(-1, s.m[4]))) * 180) / Math.PI
}

/** World position of the midpoint between the two catch pins. */
export function pinY(s: Sim): number {
  return s.py + s.m[4] * PIN_Y
}
export function pinX(s: Sim): number {
  return s.px + s.m[1] * PIN_Y
}
export function pinZ(s: Sim): number {
  return s.pz + s.m[7] * PIN_Y
}

/** Height of the ship's base above the ground. */
export function baseAltitude(s: Sim): number {
  return s.py - s.m[4] * COM_Y
}

/** Wind at a height, at a time: steady flow that slackens near the ground, plus a slow gust. */
export function windAt(s: Sim, y: number, out: { x: number; z: number }) {
  const c = s.conditions
  const shear = 0.55 + 0.45 * clamp(y / 160, 0, 1)
  const gust = 1 + c.gust * dsin(s.t * 0.55 + c.gustPhase) + c.gust * 0.5 * dsin(s.t * 1.7 + c.gustPhase * 2.3)
  const k = shear * gust * s.mode.windFactor
  out.x = c.windX * k
  out.z = c.windZ * k
}

const wind = { x: 0, z: 0 }

/**
 * Where the hull's axis is relative to one arm, at rail height.
 * `across` is the distance from the arm's centre line toward the corridor,
 * `along` the distance out from the pivot.
 */
function armFrame(theta: number, side: number, x: number, z: number, out: { across: number; along: number }) {
  const c = dcos(theta)
  const sn = dsin(theta)
  const rx = x - PIVOT_X
  const rz = z - side * PIVOT_Z
  out.along = -c * rx + side * sn * rz
  out.across = -sn * rx - side * c * rz
}

const frame = { across: 0, along: 0 }

export function stepSim(s: Sim, input: SimInput, dt: number = SUBSTEP_DT): void {
  if (s.outcome) return
  const mode = s.mode
  const m = s.m
  s.t += dt

  // --- Forces -----------------------------------------------------------------
  let fx = 0
  let fy = -EARTH_G
  let fz = 0

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

  // Two arms holding the hull squeeze it toward the middle of the gap.
  if (s.hugN && s.hugS) {
    fz += -1.6 * (s.pz + m[7] * (PAD1.railY - s.py)) - 1.4 * s.vz
  }

  // Air: the ship is a big sail broadside and a dart end-on.
  windAt(s, s.py, wind)
  const rvx = s.vx - wind.x
  const rvy = s.vy
  const rvz = s.vz - wind.z
  const axial = rvx * m[1] + rvy * m[4] + rvz * m[7]
  const sx = rvx - axial * m[1]
  const sy = rvy - axial * m[4]
  const sz = rvz - axial * m[7]
  const side = Math.sqrt(sx * sx + sy * sy + sz * sz)
  const ka = DRAG_AXIAL * (axial < 0 ? -axial : axial) * axial
  fx -= DRAG_SIDE * side * sx + ka * m[1]
  fy -= DRAG_SIDE * side * sy + ka * m[4]
  fz -= DRAG_SIDE * side * sz + ka * m[7]

  // --- Attitude control ---------------------------------------------------------
  let ax = 0
  let az = 0
  // Heading hold: keep the pins square to the arms.
  const yaw = datan2(-m[6], m[0])
  let ay = -4 * yaw - 3.5 * s.wy
  if (mode.control === 'angle') {
    const max = (mode.maxTiltDeg * Math.PI) / 180
    const dxu = dtan(clamp(input.y, -1, 1) * max)
    const dzu = dtan(clamp(input.x, -1, 1) * max)
    const inv = 1 / Math.sqrt(dxu * dxu + 1 + dzu * dzu)
    const ux = dxu * inv
    const uy = inv
    const uz = dzu * inv
    // Error axis = up × desiredUp (world)
    const ex = m[4] * uz - m[7] * uy
    const ez = m[1] * uy - m[4] * ux
    ax = 7 * ex - 4.2 * s.wx
    az = 7 * ez - 4.2 * s.wz
  } else {
    const rate = (mode.maxRateDeg * Math.PI) / 180
    ax = 5 * (clamp(input.x, -1, 1) * rate - s.wx)
    az = 5 * (-clamp(input.y, -1, 1) * rate - s.wz)
  }
  const mag = Math.sqrt(ax * ax + ay * ay + az * az)
  if (mag > TURN_ALPHA) {
    const k = TURN_ALPHA / mag
    ax *= k
    ay *= k
    az *= k
  }
  s.rcsX = ax
  s.rcsZ = az

  // --- Integrate (semi-implicit Euler) -------------------------------------------
  const pinBefore = pinY(s)
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
  // The commanded angular acceleration, taken into the body frame before it
  // becomes torque: the hull is twenty times easier to spin about its own
  // axis than to tip, so a world-frame torque would mostly twist it.
  const tbx = IX * (m[0] * ax + m[3] * ay + m[6] * az)
  const tby = IY * (m[1] * ax + m[4] * ay + m[7] * az)
  const tbz = IZ * (m[2] * ax + m[5] * ay + m[8] * az)
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
  s.qw = nw * qn
  s.qx = nx * qn
  s.qy = ny * qn
  s.qz = nz * qn
  refreshMatrix(s)

  // --- The arms -----------------------------------------------------------------
  const rail = PAD1.railY
  const py = pinY(s)
  const px = pinX(s)
  const pz = pinZ(s)
  // The hull's axis at rail height (the ship is near vertical whenever this matters).
  const up = m[4] > 0.2 ? m[4] : 0.2
  const lift = (rail - s.py) / up
  const hullX = s.px + m[1] * lift
  const hullZ = s.pz + m[7] * lift
  const spansRail = lift > -COM_Y && lift < SHIP.height - COM_Y

  // How near the pins are to where they would rest: scores a near miss.
  const dAlong = px - SWEET_X
  const near = Math.sqrt(dAlong * dAlong + pz * pz + (py - rail) * (py - rail))
  if (near < s.closest) s.closest = near

  if (!s.armsClosing) {
    const inZone = px > PAD1.x - 9 && px < PAD1.x + 19 && pz > -7 && pz < 7
    // Easy: the tower times the close for the sweet spot, allowing for how fast
    // the ship is coming down, but never before the aft flaps are through.
    const sink = s.vy < 0 ? -s.vy : 0
    let lead = SWEET_MARGIN + 0.6 + sink * mode.armCloseSeconds
    if (lead > 19) lead = 19
    const wants = mode.autoArms ? inZone && py > rail + 0.8 && py < rail + lead && s.vy < 2 : input.arms
    if (wants) {
      s.armsClosing = true
      s.events.push({ type: 'armsclosing' })
    }
  }
  if (s.armsClosing) {
    const step = (ARMS.openAngle / mode.armCloseSeconds) * dt
    for (let k = 0; k < 2; k++) {
      const sideSign = k === 0 ? -1 : 1
      const cur = k === 0 ? s.armN : s.armS
      let next = cur - step
      if (next < 0) next = 0
      let held = false
      if (spansRail) {
        // The swing at which this arm just touches the hull. The arm closes to
        // it and then follows it: it gives way if the ship drifts into it and
        // follows if the ship drifts off, as a force-limited arm does.
        const A = PIVOT_X - hullX
        const B = PIVOT_Z - sideSign * hullZ
        const R = Math.sqrt(A * A + B * B)
        if (A > 1 && A < ARMS.length - 1 && R > HUG) {
          const q = HUG / R
          let touch = datan2(q, Math.sqrt(1 - q * q)) - datan2(B, A)
          if (touch < 0) touch = 0
          if (touch <= ARMS.openAngle && next <= touch) {
            next = touch
            held = true
          }
        }
      }
      if (k === 0) {
        s.armN = next
        s.hugN = held
      } else {
        s.armS = next
        s.hugS = held
      }
    }
    if (s.hugN && s.hugS && s.hugMargin === 0) {
      s.hugMargin = py - rail === 0 ? 0.001 : py - rail
      s.events.push({ type: 'hug' })
    }
  }

  // Pins meeting the rails.
  if (pinBefore > rail && py <= rail && !s.pinsSheared) {
    const holding = s.hugN && s.hugS && s.hugMargin > 0
    const onRails = px > PIVOT_X - ARMS.length + 2 && px < PIVOT_X - 3
    if (holding && onRails && m[4] > 0.82) {
      const down = -s.vy
      if (down > mode.pinLimit) {
        s.pinsSheared = true
        s.events.push({ type: 'pins', speed: down })
      } else {
        finish(s, 'caught', null)
        return
      }
    } else if (!s.missed) {
      s.missed = true
      s.events.push({ type: 'missed' })
    }
  }

  // --- Collisions -----------------------------------------------------------------
  for (let i = 0; i < POINT_COUNT; i++) {
    const bx = POINTS[i * 3]
    const by = POINTS[i * 3 + 1]
    const bz = POINTS[i * 3 + 2]
    const wxp = s.px + m[0] * bx + m[1] * by + m[2] * bz
    const wyp = s.py + m[3] * bx + m[4] * by + m[5] * bz
    const wzp = s.pz + m[6] * bx + m[7] * by + m[8] * bz
    if (wyp <= 0) {
      const sea = seaAt(wxp, wzp)
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz)
      // m[4] is the cosine of the tilt: 0.82 is about 35 degrees, 0.966 about 15.
      if (sea && speed < 11 && m[4] > 0.82) finish(s, 'splashdown', 'sea')
      else if (!sea && speed < 5 && m[4] > 0.966) finish(s, 'ditched', 'ground')
      else finish(s, 'crashed', sea ? 'sea' : 'ground')
      return
    }
    if (wyp < 150) {
      for (let c = 0; c < COLLIDERS.length; c++) {
        const b = COLLIDERS[c].box
        if (wyp < b[4] && wxp > b[0] && wxp < b[1] && wzp > b[2] && wzp < b[3]) {
          finish(s, 'crashed', COLLIDERS[c].id)
          return
        }
      }
    }
    // The arms themselves: a beam along each rail.
    if (wyp < rail + 0.6 && wyp > rail - ARM_DEPTH) {
      for (let k = 0; k < 2; k++) {
        armFrame(k === 0 ? s.armN : s.armS, k === 0 ? -1 : 1, wxp, wzp, frame)
        if (frame.along > 0 && frame.along < ARMS.length && frame.across < ARM_RADIUS && frame.across > -ARM_RADIUS) {
          finish(s, 'crashed', i >= FLAP_START ? 'flaps' : 'arms')
          return
        }
      }
    }
  }

  // --- End conditions --------------------------------------------------------------
  if (s.px < -3000 || s.px > 3500 || s.pz < -2500 || s.pz > 2500 || s.py > 2500 || s.t > 150) {
    finish(s, 'lost', null)
  }
}

function finish(s: Sim, outcome: Outcome, cause: CrashCause | null) {
  s.outcome = outcome
  s.cause = cause
  s.burning = false
  s.endVertical = -s.vy
  s.endHorizontal = Math.sqrt(s.vx * s.vx + s.vz * s.vz)
  s.endTilt = tiltDeg(s)
  s.endAlong = pinX(s) - SWEET_X
  s.endAcross = pinZ(s)
  if (outcome === 'crashed' || outcome === 'ditched') {
    // The blast grows with the propellant still aboard.
    const reach = (outcome === 'ditched' ? 35 : 70) + 3 * s.fuel
    const cx = s.px
    const cy = s.py - COM_Y * 0.5
    const cz = s.pz
    const ids = Object.keys(BLAST_POINTS) as StructureId[]
    for (let i = 0; i < ids.length; i++) {
      const p = BLAST_POINTS[ids[i]]
      const dx = p[0] - cx
      const dy = p[1] - cy
      const dz = p[2] - cz
      if (dx * dx + dy * dy + dz * dz < reach * reach || cause === ids[i]) s.damage.push(ids[i])
    }
    // Flying into the arms or onto them takes the arms with it.
    if ((cause === 'arms' || cause === 'flaps') && s.damage.indexOf('arms') < 0) s.damage.push('arms')
  }
  s.events.push({ type: 'done', outcome })
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
