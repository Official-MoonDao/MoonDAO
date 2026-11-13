/**
 * Starbase, built from primitives. The two launch towers with their catch
 * arms and mounts are modelled by hand from lib/catch/layout.ts; everything
 * around them (tanks, buildings, walls, pipes, roads, the production site and
 * the village) is placed from lib/catch/siteMap.ts.
 */
import * as THREE from 'three'
import { ARMS, BOOSTER, MOUNT, PAD1, PAD2, TOWER, towerCentre, type Pad } from '@/lib/catch/layout'
import { MAP } from '@/lib/catch/siteMap'
import { buildBooster } from './booster'
import { Builder, canvasTexture, type Bag } from './util'

export type PadModel = {
  group: THREE.Group
  /** Carriage that rides the tower; its y is the catch-rail height. */
  carriage: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
}

export type StarbaseModel = {
  group: THREE.Group
  pad1: PadModel
  pad2: PadModel
  beacons: THREE.Mesh[]
}

type Mats = Record<string, THREE.Material>

function materials(env: THREE.Texture, bag: Bag): Mats {
  const t = <T extends THREE.Material>(m: T): T => {
    bag.push(m)
    return m
  }
  const std = (color: number, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    t(new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity: 0.9, ...extra }))
  // Corrugated cladding for the big bays: light vertical ribs.
  const ribs = canvasTexture(
    64,
    8,
    (g) => {
      for (let x = 0; x < 64; x++) {
        const v = 200 + Math.round(Math.sin((x / 64) * Math.PI * 8) * 22)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(x, 0, 1, 8)
      }
    },
    bag
  )
  ribs.repeat.set(10, 1)
  const offset = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }
  return {
    steel: std(0x2b2e32, 0.58, 0.6),
    steelLight: std(0x70757a, 0.5, 0.7),
    rail: std(0xa9adb0, 0.36, 0.85),
    white: std(0xc9ccce, 0.42, 0.1),
    frost: std(0xdfe5ea, 0.7, 0),
    concreteWall: std(0x8a857b, 0.95, 0),
    asphalt: std(0x55565a, 0.92, 0, { ...offset, polygonOffsetFactor: -3 }),
    dirt: std(0xa89a7e, 1, 0, { ...offset, polygonOffsetFactor: -3 }),
    black: std(0x17181b, 0.8, 0.2),
    bay: std(0x8a929b, 0.7, 0.3, { map: ribs }),
    bayDark: std(0x2a2d33, 0.75, 0.3),
    roof: std(0xa9adb0, 0.6, 0.3),
    house: std(0xb9b1a2, 0.9, 0),
    plate: std(0x3b3e42, 0.5, 0.8, offset),
        hull: std(0xb4b8bd, 0.3, 1),
  }
}

/**
 * A square lattice tower in its own frame: centre at the origin, arms toward
 * -z. Eight braced bays, a lift core, carriage rails, the drawworks cap with
 * its overhang, the mast, and the ship quick-disconnect arm swung clear.
 */
function tower(b: Builder, railY: number) {
  const h = TOWER.width / 2
  const H = TOWER.height
  const sections = 8
  const sh = (H - 6) / sections
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('steel', 1.9, H, 1.9, sx * h, H / 2, sz * h)
  const faces: [number, number, number, number][] = [
    [-h, -h, h, -h],
    [h, -h, h, h],
    [h, h, -h, h],
    [-h, h, -h, -h],
  ]
  for (let s = 0; s <= sections; s++) {
    const y0 = s * sh
    for (const [ax, az, bx, bz] of faces) {
      b.beam('steel', ax, y0, az, bx, y0, bz, 1.0)
      if (s === sections) continue
      b.beam('steel', ax, y0, az, bx, y0 + sh, bz, 0.75)
      b.beam('steel', bx, y0, bz, ax, y0 + sh, az, 0.75)
      const mx = (ax + bx) / 2
      const mz = (az + bz) / 2
      b.beam('steel', mx, y0, mz, mx, y0 + sh, mz, 0.45)
      b.beam('steel', ax, y0 + sh / 2, az, bx, y0 + sh / 2, bz, 0.4)
    }
    // Floor bracing, a grated landing and its handrail at each level.
    b.beam('steel', -h, y0, -h, h, y0, h, 0.5)
    b.beam('steel', h, y0, -h, -h, y0, h, 0.5)
    b.box('steelLight', 5.4, 0.2, 4.4, 2.6, y0 + 0.5, 3.1)
    b.box('steelLight', 5.4, 0.08, 0.08, 2.6, y0 + 1.6, 0.9)
    if (s < sections) {
      // Stair flights zig-zagging up beside the lift core.
      b.beam('steelLight', 0.4, y0 + 0.5, 1.4, 4.8, y0 + sh / 2, 1.4, 0.5)
      b.beam('steelLight', 4.8, y0 + sh / 2, 0.6, 0.4, y0 + sh + 0.5, 0.6, 0.5)
    }
  }
  // Lift core and the pipe runs feeding the quick-disconnect.
  b.box('steel', 3.2, H - 4, 3.2, 3, (H - 4) / 2, 3.4)
  for (const pz of [2.0, 3.0, 4.0]) b.cyl('frost', 0.28, 0.28, 104, -h - 0.6, 0, pz, 8)
  // Carriage rails up the arm face.
  for (const sx of [-1, 1]) b.box('rail', 0.7, H - 14, 0.9, sx * (h - 0.4), (H - 14) / 2 + 4, -h - 1.0)
  // Cap: the drawworks deck with its overhang on the arm side, then the mast.
  b.box('steel', 15, 6, 15, 0, H - 3, 0)
  b.box('steelLight', 13.5, 5, 9, 0, H - 3.2, -h - 4.2)
  b.box('steel', 13, 0.6, 9, 0, H - 6.2, -h - 4.2)
  b.beam('steel', -6, H - 6, -h - 8.5, -6, H - 18, -h, 0.6)
  b.beam('steel', 6, H - 6, -h - 8.5, 6, H - 18, -h, 0.6)
  b.cyl('steel', 0.18, 0.3, TOWER.mastTop - H + 6, 4, H, 4, 6)
  // Hoist cables from the cap down to the carriage.
  for (const sx of [-1, 1]) b.beam('black', sx * 3, H - 6, -h - 6, sx * 3, railY + 2, -h - 6, 0.16)
  // Ship quick-disconnect arm: well below the catch arms, reaching the same
  // way they do, swung a little aside so a ship can come down past it.
  const qy = 70
  const qx0 = -h + 1.5
  const qz0 = -h - 0.5
  const qx1 = qx0 - 9
  const qz1 = qz0 - 15
  b.box('steel', 4, 7, 3, qx0, qy, -h + 0.5)
  b.beam('steel', qx0, qy + 2.6, qz0, qx1, qy + 2.6, qz1, 0.9)
  b.beam('steel', qx0, qy - 3, qz0, qx1, qy + 0.4, qz1, 0.7)
  for (let k = 1; k < 5; k++) {
    const u = k / 5
    const v = u - 0.2
    b.beam('steel', qx0 + (qx1 - qx0) * u, qy + 2.6, qz0 + (qz1 - qz0) * u, qx0 + (qx1 - qx0) * v, qy - 3 + 3.4 * v, qz0 + (qz1 - qz0) * v, 0.4)
  }
  b.box('steelLight', 3, 3.6, 3, qx1 - 0.6, qy + 1.6, qz1 - 0.8)
  // Footing.
  b.box('concreteWall', 20, 2.4, 20, 0, 1.2, 0)
}

/** One catch arm, pivot at the origin, reaching -z. `side` is +1 for the +x arm. */
function arm(side: number, mats: Mats, bag: Bag): THREE.Group {
  const b = new Builder()
  const L = ARMS.length
  const w = 1.1 // half width
  const panels = 9
  const dz = L / panels
  const depthAt = (zz: number) => ARMS.rootDepth + (ARMS.tipDepth - ARMS.rootDepth) * Math.pow(zz / L, 0.85)
  for (const sx of [-w, w]) {
    b.beam('steel', sx, -0.4, 0, sx, -0.4, -L, 0.9, true)
    b.beam('steel', sx, -ARMS.rootDepth, 0, sx, -ARMS.tipDepth, -L, 0.8, true)
    for (let p = 0; p <= panels; p++) {
      const z0 = p * dz
      const d0 = depthAt(z0)
      b.beam('steel', sx, -0.4, -z0, sx, -d0, -z0, 0.45, true)
      if (p < panels) {
        const d1 = depthAt(z0 + dz)
        if (p % 2 === 0) b.beam('steel', sx, -0.4, -z0, sx, -d1, -z0 - dz, 0.45, true)
        else b.beam('steel', sx, -d0, -z0, sx, -0.4, -z0 - dz, 0.45, true)
      }
    }
  }
  for (let p = 0; p <= panels; p++) {
    const z0 = p * dz
    b.beam('steel', -w, -0.4, -z0, w, -0.4, -z0, 0.4, true)
    b.beam('steel', -w, -depthAt(z0), -z0, w, -depthAt(z0), -z0, 0.4, true)
    if (p < panels) b.beam('steel', -w, -0.4, -z0, w, -0.4, -z0 - dz, 0.3, true)
  }
  // Catch rail along the inner top edge: where the pins land.
  b.box('rail', 1.5, 0.5, L - 3, -side * (w - 0.35), 0.1, -L / 2 - 1)
  b.box('steelLight', 1.9, 0.9, 2.2, -side * (w - 0.35), 0.1, -L + 0.6)
  // Root knuckle and the hydraulic actuator back to the carriage.
  b.cyl('steel', 1.5, 1.5, ARMS.rootDepth + 1.5, 0, -ARMS.rootDepth - 0.5, 0, 14)
  b.beam('steelLight', side * 1.2, -2.2, -9, side * 6.5, -2.2, 3.5, 0.7, true)
  const g = b.build(mats, bag)
  g.name = side > 0 ? 'arm-right' : 'arm-left'
  return g
}

function carriage(mats: Mats, bag: Bag): THREE.Group {
  const b = new Builder()
  const h = TOWER.width / 2 + 1.6
  const z0 = -h
  for (const y of [0.5, -ARMS.rootDepth - 1]) {
    b.beam('steel', -h - 1, y, z0, h + 1, y, z0, 1.3)
    b.beam('steel', -h, y, z0, -h, y, h * 0.4, 1.0)
    b.beam('steel', h, y, z0, h, y, h * 0.4, 1.0)
  }
  for (const sx of [-1, 1]) {
    b.beam('steel', sx * h, 0.5, z0, sx * h, -ARMS.rootDepth - 1, z0, 1.3)
    b.beam('steel', sx * h, 0.5, h * 0.4, sx * h, -ARMS.rootDepth - 1, h * 0.4, 1.0)
    b.beam('steel', sx * h, 0.5, z0, sx * h, -ARMS.rootDepth - 1, h * 0.4, 0.6)
  }
  b.beam('steel', -h, 0.5, z0, h, -ARMS.rootDepth - 1, z0, 0.7)
  b.beam('steel', h, 0.5, z0, -h, -ARMS.rootDepth - 1, z0, 0.7)
  return b.build(mats, bag)
}

/**
 * Launch mount: a steel deck over a flame trench, centred at local (0, cz).
 * The trench leaves on one side only (`side`, along local x), away from the tank farm.
 */
function trenchMount(b: Builder, cz: number, side: 1 | -1) {
  const S = MOUNT.size
  const top = MOUNT.top
  b.box('steelLight', S, top - 0.5, S, 0, (top - 0.5) / 2, cz)
  b.box('plate', S - 9, 0.6, S - 9, 0, top - 0.3, cz)
  // The ring of hold-down clamps and the dark throat of the mount.
  b.cyl('black', 5.2, 5.2, 0.5, 0, top - 0.2, cz, 32)
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    b.box('steel', 1, 1.2, 1.4, Math.cos(a) * 6, top + 0.5, cz + Math.sin(a) * 6, -a)
  }
  // Deck-level service gantry and stair tower on one corner.
  b.box('steel', 3, top + 6, 3, S / 2 + 1.5, (top + 6) / 2, cz + S / 2 - 3)
  b.box('steelLight', 7, 0.3, 4, S / 2 - 2, top + 0.4, cz + S / 2 - 2)
  // Trench walls running out either side, with the scorched floor between them.
  const s = side
  b.box('concreteWall', 44, 5, 2, s * 34, 2.5, cz - 9)
  b.box('concreteWall', 44, 5, 2, s * 34, 2.5, cz + 9)
  b.box('black', 44, 0.4, 16, s * 34, 0.25, cz)
  // The closed back of the mount on the other side.
  b.box('concreteWall', 2, 5, 20, -s * 13, 2.5, cz)
}

function buildPad(p: Pad, mats: Mats, bag: Bag, trenchSide: 1 | -1): PadModel {
  const group = new THREE.Group()
  const b = new Builder()
  tower(b, p.railY)
  trenchMount(b, -TOWER.catchDist, trenchSide)
  // Floodlight masts round the pad.
  for (const [mx, mz] of [
    [34, -64],
    [-34, -64],
    [40, 14],
    [-40, 14],
  ]) {
    b.cyl('steelLight', 0.25, 0.45, 34, mx, 0, mz, 8)
    b.box('steel', 3.2, 1.6, 0.6, mx, 34.5, mz, Math.atan2(mx, mz + TOWER.catchDist))
  }
  group.add(b.build(mats, bag))
  const car = carriage(mats, bag)
  car.position.y = p.railY
  const armR = arm(1, mats, bag)
  const armL = arm(-1, mats, bag)
  armR.position.set(ARMS.pivotX, 0, -ARMS.pivotOut)
  armL.position.set(-ARMS.pivotX, 0, -ARMS.pivotOut)
  car.add(armR, armL)
  group.add(car)
  // Local -z is the way the arms reach.
  const c = towerCentre(p)
  group.position.set(c.x, 0, c.z)
  group.rotation.y = Math.atan2(-p.ax, -p.az)
  return { group, carriage: car, armL, armR }
}

/** Tanks, buildings, walls and pipes from the map. */
function mapStructures(b: Builder, far: Builder) {
  const m = new THREE.Matrix4()
  const rot = new THREE.Matrix4()
  let seed = 17
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (const [x, z, len, wid, ang, hTag] of MAP.tanks) {
    const near = Math.hypot(x, z) < 1200
    const out = near ? b : far
    const a = (-ang * Math.PI) / 180
    if (len / wid > 1.5) {
      // Horizontal cryogenic tank on saddles.
      const r = Math.min(wid / 2, 2.6)
      out.tank('white', r, len, x, r + 0.9, z, a)
      if (near) {
        for (const u of [-0.32, 0.32]) {
          out.box('concreteWall', 0.8, r + 0.9, wid * 0.9, x + Math.cos(-a) * len * u, (r + 0.9) / 2, z + Math.sin(-a) * len * u, a)
        }
      }
    } else {
      const r = (len + wid) / 4
      const h = hTag || (r > 5 ? 14 : r > 2.5 ? 9 : 5)
      out.cyl('white', r, r, h, x, 0, z, near ? 24 : 12)
      const dome = new THREE.SphereGeometry(r, near ? 24 : 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      out.add('white', dome, m.makeScale(1, 0.35, 1).setPosition(x, h, z))
    }
  }
  for (const [x, z, len, wid, ang, h, kind] of MAP.buildings) {
    const near = Math.hypot(x, z) < 1200
    const out = near ? b : far
    const a = (-ang * Math.PI) / 180
    if (kind === 5) {
      // Vehicles on display: a steel cylinder with a nose.
      const r = Math.min(4.5, wid / 2)
      out.cyl('hull', r, r, h * 0.78, x, 0, z, 20)
      out.cyl('hull', 0.4, r, h * 0.22, x, h * 0.78, z, 20)
    } else if (kind === 4) {
      // Mega Bays and the Gigabay: tall clad boxes with a dark base and a full-height door.
      out.box('bay', len, h, wid, x, h / 2, z, a)
      out.box('roof', len + 1, 1.2, wid + 1, x, h + 0.6, z, a)
      out.box('bayDark', len + 0.5, 7, wid + 0.5, x, 3.5, z, a)
      rot.makeRotationY(a)
      const dx = new THREE.Vector3(len / 2 + 0.3, 0, 0).applyMatrix4(rot)
      out.box('bayDark', 0.6, h * 0.86, wid * 0.55, x + dx.x, h * 0.43, z + dx.z, a)
    } else if (kind === 1 || kind === 2) {
      out.box(kind === 2 || rnd() < 0.4 ? 'white' : 'house', len, h, wid, x, h / 2, z, a)
      out.box('roof', len + 0.6, 0.35, wid + 0.6, x, h + 0.17, z, a)
    } else {
      const key = kind === 3 ? (len * wid > 1500 ? 'bay' : 'steelLight') : len * wid > 2500 ? 'bay' : 'white'
      out.box(key, len, h, wid, x, h / 2, z, a)
      if (len * wid > 400) out.box('roof', len + 0.8, 0.6, wid + 0.8, x, h + 0.3, z, a)
    }
  }
  const segs = (p: number[], fn: (ax: number, az: number, bx: number, bz: number) => void) => {
    for (let i = 0; i + 3 < p.length; i += 2) fn(p[i], p[i + 1], p[i + 2], p[i + 3])
  }
  for (const w of MAP.walls) {
    // Chain-link fence is all but invisible from the air; only solid walls are built.
    if (w.h < 3) continue
    segs(w.p, (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az)
      if (L < 0.5) return
      b.box('black', L, w.h, 0.5, (ax + bx) / 2, w.h / 2, (az + bz) / 2, -Math.atan2(bz - az, bx - ax))
    })
  }
  for (const p of MAP.racks) {
    segs(p, (ax, az, bx, bz) => {
      const top = 6.5
      b.beam('frost', ax, top, az, bx, top, bz, 0.7, true)
      for (const [x, z] of [
        [ax, az],
        [bx, bz],
      ]) {
        b.beam('frost', x, 1.6, z, x, top, z, 0.7, true)
        b.box('steel', 0.6, top, 0.6, x + 1.2, top / 2, z + 1.2)
        b.box('steel', 0.6, top, 0.6, x - 1.2, top / 2, z - 1.2)
      }
    })
  }
  for (const p of MAP.pipes) {
    segs(p, (ax, az, bx, bz) => {
      b.beam('frost', ax, 1.6, az, bx, 1.6, bz, 0.7, true)
      b.box('steel', 0.4, 1.6, 0.4, (ax + bx) / 2, 0.8, (az + bz) / 2)
    })
  }
}

/** Roads as flat ribbons following the mapped centre lines. */
function roads(mats: Mats, bag: Bag): THREE.Group {
  const group = new THREE.Group()
  for (const kind of [0, 1]) {
    const pos: number[] = []
    for (const r of MAP.roads) {
      // Only the highway and streets are asphalt; service roads and tracks are graded dirt.
      if ((r.k === 1 || r.w < 6 ? 1 : 0) !== kind) continue
      const p = r.p
      const n = p.length / 2
      const hw = r.w / 2
      const left: number[] = []
      const right: number[] = []
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1)
        const c = Math.min(n - 1, i + 1)
        let dx = p[c * 2] - p[a * 2]
        let dz = p[c * 2 + 1] - p[a * 2 + 1]
        const L = Math.hypot(dx, dz) || 1
        dx /= L
        dz /= L
        left.push(p[i * 2] - dz * hw, p[i * 2 + 1] + dx * hw)
        right.push(p[i * 2] + dz * hw, p[i * 2 + 1] - dx * hw)
      }
      for (let i = 0; i < n - 1; i++) {
        const y = 0.1
        // Wound so the face normal points up (x east, z south).
        pos.push(left[i * 2], y, left[i * 2 + 1], left[i * 2 + 2], y, left[i * 2 + 3], right[i * 2], y, right[i * 2 + 1])
        pos.push(right[i * 2], y, right[i * 2 + 1], left[i * 2 + 2], y, left[i * 2 + 3], right[i * 2 + 2], y, right[i * 2 + 3])
      }
    }
    if (!pos.length) continue
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    // Flat on the ground: every normal is straight up, whichever way the road was drawn.
    const nor = new Float32Array(pos.length)
    for (let i = 1; i < nor.length; i += 3) nor[i] = 1
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    bag.push(geo)
    const mat = (kind === 0 ? mats.asphalt : mats.dirt) as THREE.MeshStandardMaterial
    // Roads are flat on flat ground. Drawn right after it with no depth test,
    // they can never flicker against it in the distance; everything built
    // later still draws over them.
    mat.depthTest = false
    mat.depthWrite = false
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    mesh.renderOrder = -1
    group.add(mesh)
  }
  return group
}

export function buildStarbase(env: THREE.Texture, bag: Bag): StarbaseModel {
  const mats = materials(env, bag)
  const group = new THREE.Group()

  // Pad 1's trench runs south and Pad 2's west: both point away from the tank farm.
  const pad1 = buildPad(PAD1, mats, bag, -1)
  const pad2 = buildPad(PAD2, mats, bag, 1)
  group.add(pad1.group, pad2.group)
  setArms(pad1, 1)
  setArms(pad2, 0)

  // A Super Heavy booster hanging in the second tower's arms.
  const booster = buildBooster(env, bag)
  booster.position.set(0, PAD2.railY + 0.45 - BOOSTER.catchY, -TOWER.catchDist)
  pad2.group.add(booster)

  const near = new Builder()
  const far = new Builder()
  mapStructures(near, far)
  group.add(near.build(mats, bag))
  group.add(far.build(mats, bag, false))
  group.add(roads(mats, bag))

  // Red obstruction lights on the tower tops.
  const beacons: THREE.Mesh[] = []
  const lamp = new THREE.SphereGeometry(0.55, 10, 8)
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.2) })
  bag.push(lamp, lampMat)
  for (const p of [PAD1, PAD2]) {
    const c = towerCentre(p)
    for (const [ox, oz] of [
      [-7, -7],
      [7, 7],
    ]) {
      const m = new THREE.Mesh(lamp, lampMat)
      m.position.set(c.x + ox, TOWER.height + 0.6, c.z + oz)
      beacons.push(m)
      group.add(m)
    }
  }
  return { group, pad1, pad2, beacons }
}

/** Swing a pad's arms: 0 closed on a vehicle, 1 fully open. */
export function setArms(pad: PadModel, open: number) {
  pad.armR.rotation.y = -open * ARMS.openAngle
  pad.armL.rotation.y = open * ARMS.openAngle
}
