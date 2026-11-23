/**
 * The day's landing site for First Tracks.
 *
 * Everyone gets the same site on a given UTC day, derived from the mission
 * number (the seed shared with Touchdown and Catch). What changes each day:
 * the craters, the rocks, the soft-regolith patches, where the twelve science
 * targets are and what each one holds, the sun, and which way the rover is parked on the deck.
 *
 * The leaderboard re-drives a player's inputs on the server, so everything
 * here must come out bit-identical in every JavaScript engine: only + - * /,
 * Math.sqrt and the deterministic trig in lib/touchdown/detmath.ts. No
 * Math.sin, Math.exp, Math.pow or Math.hypot.
 *
 * Coordinates: metres, y up. The lander sits at the origin with its ramp
 * running toward +z. A heading of 0 faces +z; forward is (sin h, cos h).
 *
 * Dependency-free apart from the seed and trig helpers: imported by the
 * headless bot and the leaderboard API.
 */
import { dcos, dsin } from '@/lib/touchdown/detmath'
import { hash32, missionSeed, mulberry32, type Rng } from '@/lib/touchdown/mission'

// --- Rover and lander geometry (shared by the sim, par and the 3D scene) -----------

/** Half the wheel track and half the wheelbase, m. */
export const HALF_W = 0.45
export const HALF_L = 0.5
/** Collision radius of the rover against rocks and the lander, m. */
export const COLL_R = 0.58
/** Wheel clearance: rocks taller than this stop the rover, m. */
export const CLEAR = 0.2
export const WHEEL_R = 0.2

export type Rect = { x0: number; x1: number; z0: number; z1: number }

/**
 * The lander carries the rover inside its hull, on a tray. On the surface the
 * bay's two doors swing open, the tray slides out on its rails with the rover
 * on it, and the ramp unfolds from the tray's outer edge. The deck is that
 * tray: no wider than the bay it came out of.
 */
/** Height of the tray (and of the bay floor it slid out of), m. */
export const DECK_Y = 0.85
/** The tray, run out, with the rover parked on it. Its back edge is the hull's front face. */
export const DECK: Rect = { x0: -0.8, x1: 0.8, z0: -0.6, z1: 1.1 }
/** The egress ramp: 1.6 m wide, the tray's full width, down to the regolith. */
export const RAMP: Rect = { x0: -0.8, x1: 0.8, z0: 1.1, z1: 3.2 }
/** Corner radius of the lander's eight-sided hull, and how far its front face stands from its centre, m. */
export const HULL_R = 2.2
export const HULL_APOTHEM = 2.0325
/** Where the lander stands: its front face is the tray's back edge. */
export const LANDER_CENTER_Z = DECK.z0 - HULL_APOTHEM
/** The lander itself, legs included: a no-go box once the rover is on the ground. */
export const BODY: Rect = { x0: -3.1, x1: 3.1, z0: LANDER_CENTER_Z - 3.1, z1: DECK.z0 }
/** Where the rover is parked on the tray: its middle. */
export const START_X = 0
export const START_Z = 0.25
/** Where a perfect first leg starts: just past the ramp foot. */
export const RAMP_FOOT: [number, number] = [0, RAMP.z1 + 0.8]

/** The rover cannot leave this square, m from the origin. */
export const WORLD = 56
export const N_TARGETS = 12
/** How many of the day's targets are of each kind. They add up to N_TARGETS. */
export const KIND_COUNT: Record<TargetKind, number> = { image: 4, rock: 4, ice: 4 }
/** Seconds the rover must hold still for each job. */
export const HOLD_SECONDS: Record<TargetKind, number> = { image: 1, rock: 1.5, ice: 2.5 }
/** Rocks shorter than this are pebbles: drawn, never felt. */
export const BUMP_MIN = 0.07
/** Radius of a science target's ring, m. */
export const TARGET_RING = 1.6

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az))

/** `science` marks a crater dug round a science target: par may route down its wall. */
export type Crater = { x: number; z: number; r: number; depth: number; rim: number; reach2: number; science: boolean }
/** `h` is height above the ground, `r` the footprint radius, `sq` a squash across one axis. */
export type Rock = { x: number; z: number; h: number; r: number; y: number; rot: number; sq: number; /** The boulder a rock target is there for: never cleared away. */ anchor?: boolean }
export type Soft = { x: number; z: number; r: number }
/**
 * What the rover is sent to a target to do. Each job needs the rover parked
 * and still for as long as the instrument takes:
 *
 *   image  photograph undisturbed regolith on open ground. Quick, least points.
 *   rock   put the spectrometer on a boulder: the ring sits right beside one.
 *   ice    drill the floor of a crater for water ice. Longest and worth most,
 *          and the crater wall has to be taken straight, down and back up.
 */
export type TargetKind = 'image' | 'rock' | 'ice'
/**
 * `find` is what the target turns out to hold, as an index into FINDS: it
 * multiplies the job's points. Hidden from the player until the job is done,
 * and the same for everyone on the same day, so it can be learned and passed on.
 */
export type Target = { x: number; z: number; kind: TargetKind; find: number }

export type Find = { factor: number; label: string }
export const FINDS: Find[] = [
  { factor: 0.5, label: 'Poor find' },
  { factor: 1, label: 'Fair find' },
  { factor: 1.5, label: 'Good find' },
  { factor: 2.5, label: 'Rich find' },
]
/** The day's twelve finds, dealt out over the targets: three poor, four fair, three good, two rich. */
const FIND_DECK = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3]
/** Rich finds a day. */
export const RICH_FINDS = 2
/** Rings round the lander the targets are spread over, m from it: four targets in each. */
const BANDS: [number, number][] = [
  [10.5, 15],
  [18, 27],
  [30, 40],
]

export type Site = {
  mission: number
  seed: number
  craters: Crater[]
  /** Every rock, pebbles included (for drawing). */
  rocks: Rock[]
  /** Rocks taller than the wheels, bucketed by cell for collision. */
  hazards: Map<number, Rock[]>
  /** Rocks the wheels ride over, bucketed by cell: they jolt and slow the rover. */
  bumps: Map<number, Rock[]>
  softs: Soft[]
  targets: Target[]
  /** Degrees above the horizon, before the mode's bonus. */
  sunElevation: number
  /** Radians from the ramp's direction; the sun stands toward (sin az, cos az). 30 to 90 degrees to either side. */
  sunAzimuth: number
  /** Which way the rover is parked on the deck, radians. Never facing the ramp. */
  startHeading: number
  /**
   * Seconds a flawless driver with no signal delay needs for the day's short
   * tour, by par. The day's clock is sized from it (see day.ts), so a hard
   * site gets more time and an easy one less. 0 until day.ts fills it in.
   */
  parSeconds: number
  /** Terrain height, m. */
  ground: (x: number, z: number) => number
  /** 0..1 softness of the regolith at a point. */
  softAt: (x: number, z: number) => number
  /** The site's value noise, about -1..1, for the scene's shading. */
  noise: (x: number, z: number) => number
}

const TWO_PI = 6.283185307179586

/**
 * The visiting order with the least straight-line driving from a start point,
 * and its length. Exact, by dynamic programming over subsets (12 targets: 49,152 states).
 */
export function shortestTour(t: Target[], x: number, z: number): { order: number[]; length: number } {
  const n = t.length
  if (!n) return { order: [], length: 0 }
  const full = 1 << n
  const best = new Float64Array(full * n).fill(Infinity)
  const prev = new Int16Array(full * n).fill(-1)
  for (let i = 0; i < n; i++) best[(1 << i) * n + i] = dist(t[i].x, t[i].z, x, z)
  for (let mask = 1; mask < full; mask++) {
    for (let last = 0; last < n; last++) {
      const c = best[mask * n + last]
      if (c === Infinity) continue
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue
        const m2 = mask | (1 << next)
        const c2 = c + dist(t[next].x, t[next].z, t[last].x, t[last].z)
        if (c2 < best[m2 * n + next]) {
          best[m2 * n + next] = c2
          prev[m2 * n + next] = last
        }
      }
    }
  }
  let last = 0
  for (let i = 1; i < n; i++) if (best[(full - 1) * n + i] < best[(full - 1) * n + last]) last = i
  const length = best[(full - 1) * n + last]
  const order: number[] = []
  let mask = full - 1
  while (last >= 0 && mask) {
    order.push(last)
    const p = prev[mask * n + last]
    mask &= ~(1 << last)
    last = p
  }
  return { order: order.reverse(), length }
}

/** Size of a hazard bucket, m. */
export const CELL = 4
export const cellKey = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512)
export const cellOf = (v: number) => Math.floor(v / CELL)

function makeNoise(rng: Rng): (x: number, z: number) => number {
  const perm = new Uint8Array(512)
  const p: number[] = []
  for (let i = 0; i < 256; i++) p.push(i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  const grad = new Float64Array(256)
  for (let i = 0; i < 256; i++) grad[i] = rng() * 2 - 1
  const v = (x: number, z: number) => grad[perm[(x & 255) + perm[z & 255]]]
  return (x, z) => {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const xf = x - xi
    const zf = z - zi
    const u = xf * xf * (3 - 2 * xf)
    const w = zf * zf * (3 - 2 * zf)
    const a = v(xi, zi)
    const b = v(xi + 1, zi)
    const c = v(xi, zi + 1)
    const d = v(xi + 1, zi + 1)
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w
  }
}

export function siteSeed(mission: number): number {
  return (missionSeed(mission) ^ hash32(0xf1257)) >>> 0
}

/** The raw site. Game code wants `siteFor` in day.ts, which also makes sure no target is walled in. */
export function generateSite(mission: number): Site {
  const seed = siteSeed(mission)
  const rng = mulberry32(seed)
  const noise = makeNoise(rng)

  // Filled in below, once the targets are known: the ground reads this list when it is called.
  const craters: Crater[] = []

  const ground = (x: number, z: number) => {
    let h = 0.55 * noise(x / 17, z / 17) + 0.22 * noise(x / 6.3 + 11, z / 6.3 - 7) + 0.06 * noise(x / 2.1 - 3, z / 2.1 + 5)
    // Level ground under the lander and the ramp foot.
    h *= smooth(6.5, 14, dist(x, z, 0, -1.6))
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i]
      const dx = x - c.x
      const dz = z - c.z
      const d2 = dx * dx + dz * dz
      if (d2 > c.reach2) continue
      const d = Math.sqrt(d2) / c.r
      if (d < 1) h += c.depth * (d * d - 1) + c.rim
      else {
        // Raised rim falling away to nothing at 1.9 radii.
        const q = (d - 1) / 0.9
        const k = 1 - q * q
        const k2 = k * k
        h += c.rim * k2 * k2 * k2
      }
    }
    return h
  }

  // --- Science targets: all round the lander, near, middling and far, one to a
  // twelfth of the compass. There are more than the clock allows: which to go
  // for, and in what order, is the puzzle.
  const targets: Target[] = []
  const placeTargets = () => {
    const turn = rng() * TWO_PI
    // Near, middle, far in a shuffled order, repeated round the compass: neighbours are never in the same ring.
    const rings = [0, 1, 2]
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = rings[i]
      rings[i] = rings[j]
      rings[j] = t
    }
    for (let i = 0; i < N_TARGETS; i++) {
      for (let k = 0; k < 60; k++) {
        const a = turn + ((i + 0.15 + rng() * 0.7) / N_TARGETS) * TWO_PI
        // After a run of failures, try the other rings too.
        const band = BANDS[k < 30 ? rings[i % 3] : Math.floor(rng() * 3)]
        const d = band[0] + rng() * (band[1] - band[0])
        const x = dsin(a) * d
        const z = dcos(a) * d
        // Clear of the lander, its legs and the ramp foot.
        if (dist(x, z, 0, 2) < 9 || dist(x, z, 0, LANDER_CENTER_Z) < 9) continue
        if (targets.some((t) => dist(t.x, t.z, x, z) < 8.5)) continue
        targets.push({ x, z, kind: 'image', find: 1 })
        break
      }
    }
  }
  // Now and then a target finds no room: draw again, and keep the fullest draw.
  let kept: Target[] = []
  for (let attempt = 0; attempt < 8; attempt++) {
    targets.length = 0
    placeTargets()
    if (targets.length > kept.length) kept = targets.slice()
    if (targets.length === N_TARGETS) break
  }
  targets.length = 0
  for (const t of kept) targets.push(t)
  // What each one holds.
  {
    const deck = FIND_DECK.slice()
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = deck[i]
      deck[i] = deck[j]
      deck[j] = t
    }
    for (let i = 0; i < targets.length; i++) targets[i].find = deck[i % deck.length]
  }

  // --- Ice targets sit on a crater floor. The crater is deep enough that its
  // wall tips a rover crossing it sideways, shallow enough to drive straight
  // down and back out. Never beside the lander.
  // --- Rock targets sit beside a boulder (placed with the rocks, below).
  {
    const pool: number[] = []
    for (let i = 0; i < targets.length; i++) if (dist(targets[i].x, targets[i].z, 0, 0) > 16) pool.push(i)
    for (let n = 0; n < KIND_COUNT.ice && pool.length; n++) {
      const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0]
      const t = targets[pick]
      const r = 3.4 + rng() * 1.5
      const k = 0.235 + rng() * 0.035
      t.kind = 'ice'
      craters.push({ x: t.x, z: t.z, r, depth: k * r, rim: 0.07 * r, reach2: 1.9 * r * (1.9 * r), science: true })
    }
    // A boulder can stand anywhere, so the rock targets may also be near the lander.
    for (let n = 0; n < KIND_COUNT.rock; n++) {
      const draw = rng()
      const from = pool.length ? pool : targets.map((t, i) => (t.kind === 'image' ? i : -1)).filter((i) => i >= 0)
      if (!from.length) break
      const pick = from.splice(Math.floor(draw * from.length), 1)[0]
      targets[pick].kind = 'rock'
    }
  }

  // --- Craters: a few big bowls and a scatter of small ones, none under the lander or a target ---
  for (let tries = 0; craters.length < 22 && tries < 600; tries++) {
    const u = rng()
    const r = 1.5 + 7.5 * u * u
    const k = 0.2 + rng() * 0.1
    const a = rng() * TWO_PI
    const d = 8 + rng() * 44
    const x = dsin(a) * d
    const z = dcos(a) * d
    if (dist(x, z, 0, 2) < r + 9) continue
    if (craters.some((c) => dist(c.x, c.z, x, z) < (c.r + r) * 0.9)) continue
    if (targets.some((t) => dist(t.x, t.z, x, z) < r * 1.15 + 1.6)) continue
    craters.push({ x, z, r, depth: k * r, rim: 0.07 * r, reach2: 1.9 * r * (1.9 * r), science: false })
  }

  // --- Soft regolith: half the patches sit on the way to a target ---
  const softs: Soft[] = []
  for (let i = 0; i < 13; i++) {
    let x: number
    let z: number
    const r = 2.5 + rng() * 3.5
    if (i < 5 && targets[i]) {
      const f = 0.3 + rng() * 0.4
      const t = targets[i]
      x = t.x * f + (rng() - 0.5) * 4
      z = 4.4 + (t.z - 4.4) * f + (rng() - 0.5) * 4
    } else {
      const a = rng() * TWO_PI
      const d = 10 + rng() * 36
      x = dsin(a) * d
      z = dcos(a) * d
    }
    if (dist(x, z, 0, 5) < r + 5) continue
    if (targets.some((t) => dist(t.x, t.z, x, z) < r + (t.kind === 'ice' ? 7 : 1.2))) continue
    softs.push({ x, z, r })
  }
  const softAt = (x: number, z: number) => {
    let s = 0
    for (let i = 0; i < softs.length; i++) {
      const p = softs[i]
      const dx = x - p.x
      const dz = z - p.z
      if (dx * dx + dz * dz > p.r * p.r * 1.6) continue
      const d = Math.sqrt(dx * dx + dz * dz) * (1 + 0.18 * noise(x * 0.7 + 40, z * 0.7))
      if (d < p.r) {
        const v = 1 - smooth(p.r * 0.55, p.r, d)
        if (v > s) s = v
      }
    }
    return s
  }

  // --- Rocks: hazards stop the rover, small ones are driven over, pebbles are for looks ---
  const rocks: Rock[] = []
  const hazards = new Map<number, Rock[]>()
  const bumps = new Map<number, Rock[]>()
  const bucket = (map: Map<number, Rock[]>, rock: Rock) => {
    const key = cellKey(cellOf(rock.x), cellOf(rock.z))
    const list = map.get(key)
    if (list) list.push(rock)
    else map.set(key, [rock])
  }
  const okRock = (x: number, z: number, h: number) => {
    if (Math.abs(x) > 55 || Math.abs(z) > 55) return false
    const tall = h > CLEAR
    if (dist(x, z, 0, -1.2) < (tall ? 7.5 : 6)) return false
    // A clear lane off the end of the ramp.
    if (tall && Math.abs(x) < 2.2 && z > 0 && z < 11) return false
    if (tall && targets.some((t) => dist(t.x, t.z, x, z) < 2.6)) return false
    // Nothing tall on a science crater's wall: the way in and out stays open.
    if (tall && craters.some((c) => c.science && dist(c.x, c.z, x, z) < c.r * 1.25)) return false
    return true
  }
  const addRock = (x: number, z: number, h: number, r: number) => {
    const rot = rng() * TWO_PI
    const sq = 0.75 + rng() * 0.4
    if (!okRock(x, z, h)) return
    const rock = { x, z, h, r, y: ground(x, z), rot, sq }
    rocks.push(rock)
    if (h > CLEAR) bucket(hazards, rock)
    else if (h >= BUMP_MIN) bucket(bumps, rock)
  }
  const rockSpot = (nearRim: boolean): [number, number] => {
    if (nearRim && craters.length) {
      // Ejecta: thickest round the bigger, earlier craters.
      const c = craters[Math.floor(Math.sqrt(rng()) * craters.length)]
      const a = rng() * TWO_PI
      const d = c.r * (1 + rng() * 0.7)
      return [c.x + dsin(a) * d, c.z + dcos(a) * d]
    }
    const a = rng() * TWO_PI
    const d = Math.sqrt(rng()) * 52
    return [dsin(a) * d, dcos(a) * d]
  }
  // The boulder each rock target is there for: big, and close enough to the
  // ring that parking on the centre means parking right beside it.
  for (const t of targets) {
    const a = rng() * TWO_PI
    const h = 0.85 + rng() * 0.45
    const r = h * 1.05
    if (t.kind !== 'rock') continue
    // The rover's centre can come within COLL_R + 0.8 r of a rock: leave the ring's centre just clear.
    const d = COLL_R + r * 0.8 + 0.45
    const rock: Rock = { x: t.x + dsin(a) * d, z: t.z + dcos(a) * d, h, r, y: 0, rot: rng() * TWO_PI, sq: 0.9, anchor: true }
    rock.y = ground(rock.x, rock.z)
    rocks.push(rock)
    bucket(hazards, rock)
  }
  // Boulder belts: a ragged line of rocks across the way between two targets.
  // Some gaps are wide enough to thread, most are not, and the ends can always
  // be driven round: the short way is a risk, the safe way is longer.
  {
    const order = shortestTour(targets, RAMP_FOOT[0], RAMP_FOOT[1]).order
    const stops: [number, number][] = [[RAMP_FOOT[0], RAMP_FOOT[1] + 3]]
    for (const i of order) stops.push([targets[i].x, targets[i].z])
    const legs: [number, number, number, number][] = []
    for (let i = 1; i < stops.length; i++) legs.push([stops[i - 1][0], stops[i - 1][1], stops[i][0], stops[i][1]])
    // And two more between targets that are not neighbours on the short tour.
    for (let n = 0; n < 2; n++) {
      const a = targets[Math.floor(rng() * targets.length)]
      const b = targets[Math.floor(rng() * targets.length)]
      legs.push([a.x, a.z, b.x, b.z])
    }
    for (const [ax, az, bx, bz] of legs) {
      const len = dist(ax, az, bx, bz)
      const draw = rng()
      const at = 0.35 + rng() * 0.3
      const half = 3.5 + rng() * 3
      if (len < 7 || draw < 0.25) continue
      const ux = (bx - ax) / len
      const uz = (bz - az) / len
      const cx = ax + (bx - ax) * at
      const cz = az + (bz - az) * at
      for (let d = -half; d <= half; d += 1.15 + rng() * 1.75) {
        const along = (rng() - 0.5) * 1.4
        const u = rng()
        const h = 0.24 + u * u * 0.45
        addRock(cx - uz * d + ux * along, cz + ux * d + uz * along, h, h * (1.1 + rng() * 0.45))
      }
    }
  }
  for (let i = 0; i < 210; i++) {
    const [x, z] = rockSpot(rng() < 0.45)
    const u = rng()
    const h = 0.22 + u * Math.sqrt(u) * 0.4
    addRock(x, z, h, h * (1.1 + rng() * 0.5))
  }
  for (let i = 0; i < 18; i++) {
    const [x, z] = rockSpot(rng() < 0.5)
    const h = 0.7 + rng() * 0.8
    addRock(x, z, h, h * 1.2)
  }
  // Small rocks: the wheels climb over them, and feel every one.
  for (let i = 0; i < 900; i++) {
    const [x, z] = rockSpot(rng() < 0.3)
    const h = 0.05 + rng() * 0.15
    addRock(x, z, h, h * 1.7)
  }

  const sunElevation = 5 + rng() * 7
  // The sun stands off to one side and ahead of the lander, never behind it:
  // the lander's long shadow falls clear of the deck, the ramp's surface is
  // lit, and rocks ahead are side-lit.
  const sunSide = rng() < 0.5 ? -1 : 1
  const sunAzimuth = sunSide * (0.52 + rng() * 1.05)
  // Parked across the deck: lining up with the ramp is the first job.
  const startHeading = (rng() < 0.5 ? -1 : 1) * (1.0 + rng() * 0.9)

  return { mission, seed, craters, rocks, hazards, bumps, softs, targets, parSeconds: 0, sunElevation, sunAzimuth, startHeading, ground, softAt, noise }
}
