/**
 * Starbase, built from primitives. The two launch towers with their catch
 * arms and mounts are modelled by hand from lib/catch/layout.ts; everything
 * around them (tanks, buildings, walls, pipes, roads, the production site and
 * the village) is placed from lib/catch/siteMap.ts.
 */
import * as THREE from 'three'
import { ARMS, BOOSTER, MOUNT, PAD1, PAD2, TOWER, towerCentre, type Pad } from '@/lib/catch/layout'
import { MAP, shoreX } from '@/lib/catch/siteMap'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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

/** What the structures share with the ground so cloud shadows match across both. */
export type Weathering = { noise: THREE.Texture; time: { value: number }; cloud: { value: number } }

/**
 * Nothing at a launch site is clean. This adds, in world space so it needs no
 * texture coordinates: rain streaks down the faces, broad patchiness, fine
 * grain, optional pour or panel lines, and a skirt of dust splashed up from
 * the ground.
 */
function weather(
  mat: THREE.MeshStandardMaterial,
  shared: Weathering,
  o: { streak?: number; tone?: number; base?: number; joint?: number }
): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWNoise = { value: shared.noise }
    shader.uniforms.uTime = shared.time
    shader.uniforms.uCloud = shared.cloud
    shader.uniforms.uW = { value: new THREE.Vector4(o.streak ?? 0.25, o.tone ?? 0.1, o.base ?? 0.5, o.joint ?? 0) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'varying vec3 vWp;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', 'varying vec3 vWp;\nuniform sampler2D uWNoise;\nuniform vec4 uW;\nuniform float uTime;\nuniform float uCloud;\n#include <common>')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  float ws = texture2D(uWNoise, vec2((vWp.x + vWp.z) / 7.0, vWp.y / 60.0)).r;
  float wb = texture2D(uWNoise, (vWp.xz + vWp.y * 0.7) / 41.0).g;
  float wf = texture2D(uWNoise, (vWp.xz * 1.3 + vWp.y) / 3.1).b;
  vec3 c = diffuseColor.rgb;
  // Rain streaks run down walls, not across flat tops: on a horizontal face
  // the streak pattern has no height to vary along, so it is sampled far too
  // coarsely and shimmers. They also fade out with distance, where they are
  // finer than a pixel anyway.
  float wDist = length(vViewPosition);
  vec3 wN = normalize((vec4(normalize(vNormal), 0.0) * viewMatrix).xyz);
  float wSide = smoothstep(0.25, 0.6, 1.0 - abs(wN.y)) * (1.0 - smoothstep(220.0, 650.0, wDist));
  c *= mix(1.0, 0.6 + 0.8 * ws, uW.x * wSide);
  c *= 1.0 + uW.y * (wb * 2.0 - 1.0);
  c *= 0.95 + 0.1 * mix(wf, 0.5, smoothstep(60.0, 260.0, wDist));
  if (uW.w > 0.0) c *= 1.0 - 0.18 * smoothstep(0.47, 0.5, abs(fract(vWp.y / uW.w) - 0.5));
  float splash = smoothstep(2.4, 0.0, vWp.y) * (0.5 + 0.5 * mix(wf, 0.5, smoothstep(60.0, 260.0, wDist)));
  c = mix(c, vec3(0.40, 0.34, 0.24), splash * uW.z);
  float cloudSh = smoothstep(0.50, 0.72, texture2D(uWNoise, vWp.xz / 3100.0 + uTime * vec2(0.0021, 0.0008)).r * 0.65 + texture2D(uWNoise, vWp.xz / 1300.0 + uTime * vec2(0.0045, 0.0017)).g * 0.35);
  diffuseColor.rgb = c * (1.0 - uCloud * cloudSh);
}`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (0.78 + 0.5 * texture2D(uWNoise, (vWp.xz + vWp.y * 0.7) / 23.0).g), 0.05, 1.0);`
      )
  }
  mat.customProgramCacheKey = () => 'catch-weather'
  return mat
}

function materials(env: THREE.Texture, bag: Bag, shared: Weathering): Mats {
  const t = <T extends THREE.Material>(m: T): T => {
    bag.push(m)
    return m
  }
  const std = (
    color: number,
    roughness: number,
    metalness: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
    w: Parameters<typeof weather>[2] = {}
  ) => weather(t(new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity: 0.9, ...extra })), shared, w)
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
    steel: std(0x2b2e32, 0.58, 0.6, {}, { streak: 0.2, tone: 0.12, base: 0.45 }),
    steelLight: std(0x70757a, 0.5, 0.7, {}, { streak: 0.3, tone: 0.14, base: 0.5 }),
    rail: std(0xa9adb0, 0.36, 0.85, {}, { streak: 0.2, tone: 0.1, base: 0 }),
    white: std(0xc9ccce, 0.42, 0.1, {}, { streak: 0.34, tone: 0.1, base: 0.6, joint: 2.4 }),
    tank: std(0xdcdfe1, 0.34, 0.15, {}, { streak: 0.26, tone: 0.06, base: 0.4 }),
    frost: std(0xdfe5ea, 0.7, 0, {}, { streak: 0.15, tone: 0.08, base: 0.3 }),
    concreteWall: std(0x8a857b, 0.95, 0, {}, { streak: 0.6, tone: 0.2, base: 0.65, joint: 1.25 }),
    asphalt: std(0x55565a, 0.92, 0, { ...offset, polygonOffsetFactor: -3 }, { streak: 0, tone: 0.24, base: 0 }),
    dirt: std(0xa89a7e, 1, 0, { ...offset, polygonOffsetFactor: -3 }, { streak: 0, tone: 0.2, base: 0 }),
    paint: std(0xd2b23a, 0.8, 0, { ...offset, polygonOffsetFactor: -4 }, { streak: 0, tone: 0.3, base: 0 }),
    paintEdge: std(0xcfcfca, 0.8, 0, { ...offset, polygonOffsetFactor: -4 }, { streak: 0, tone: 0.3, base: 0 }),
    black: std(0x17181b, 0.8, 0.2, {}, { streak: 0.3, tone: 0.25, base: 0.3 }),
    bay: std(0x8a929b, 0.7, 0.3, { map: ribs }, { streak: 0.34, tone: 0.1, base: 0.5 }),
    bayDark: std(0x2a2d33, 0.75, 0.3, {}, { streak: 0.2, tone: 0.12, base: 0.5 }),
    roof: std(0xa9adb0, 0.6, 0.3, {}, { streak: 0, tone: 0.2, base: 0 }),
    house: std(0xb9b1a2, 0.9, 0, {}, { streak: 0.3, tone: 0.15, base: 0.6 }),
    plate: std(0x3b3e42, 0.5, 0.8, offset, { streak: 0, tone: 0.2, base: 0 }),
    car0: std(0xe2e2de, 0.4, 0.3, {}, { streak: 0.15, tone: 0.05, base: 0.7 }),
    car1: std(0x2c5886, 0.5, 0.3, {}, { streak: 0.3, tone: 0.1, base: 0.6 }),
    car2: std(0x94392c, 0.55, 0.3, {}, { streak: 0.35, tone: 0.12, base: 0.6 }),
    car3: std(0xd09a1c, 0.5, 0.3, {}, { streak: 0.3, tone: 0.1, base: 0.6 }),
    car4: std(0x62666b, 0.5, 0.4, {}, { streak: 0.3, tone: 0.1, base: 0.6 }),
    glass: std(0x10161c, 0.08, 0.6),
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
      out.tank('tank', r, len, x, r + 0.9, z, a)
      if (near) {
        // Stiffening rings, a relief stack and the fill line dropping off one end.
        const ax = Math.cos(-a)
        const az = Math.sin(-a)
        for (const u of [-0.2, 0.2]) {
          rot.makeRotationY(a).multiply(m.makeRotationZ(Math.PI / 2)).setPosition(x + ax * len * u, r + 0.9, z + az * len * u)
          out.add('steelLight', new THREE.CylinderGeometry(r + 0.07, r + 0.07, 0.4, 24, 1, true), rot)
        }
        out.cyl('steelLight', 0.14, 0.14, 1.6, x + ax * len * 0.1, r * 2 + 0.8, z + az * len * 0.1, 8)
        const ex = x + ax * (len / 2 + 0.5)
        const ez = z + az * (len / 2 + 0.5)
        out.beam('frost', ex, r + 0.9, ez, ex, 1.6, ez, 0.45, true)
        for (const u of [-0.32, 0.32]) {
          out.box('concreteWall', 0.8, r + 0.9, wid * 0.9, x + Math.cos(-a) * len * u, (r + 0.9) / 2, z + Math.sin(-a) * len * u, a)
        }
      }
    } else {
      const r = (len + wid) / 4
      const h = hTag || (r > 5 ? 14 : r > 2.5 ? 9 : 5)
      out.cyl('tank', r, r, h, x, 0, z, near ? 24 : 12)
      if (near) {
        out.cyl('concreteWall', r + 0.35, r + 0.35, 0.5, x, 0, z, 24)
        out.cyl('steelLight', r + 0.06, r + 0.06, 0.3, x, h - 0.3, z, 24, true)
        out.box('steelLight', 0.12, h, 0.6, x + r + 0.1, h / 2, z)
      }
      const dome = new THREE.SphereGeometry(r, near ? 24 : 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      out.add('tank', dome, m.makeScale(1, 0.35, 1).setPosition(x, h, z))
    }
  }
  for (const [x, z, len, wid, ang, h, kind] of MAP.buildings) {
    const near = Math.hypot(x, z) < 1200
    const out = near ? b : far
    const a = (-ang * Math.PI) / 180
    if (kind === 6) {
      // A low concrete kerb or bund wall.
      out.box('concreteWall', len, h, wid, x, h / 2, z, a)
    } else if (kind === 5) {
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
      if (near && h < 12) {
        // A roller door on one long side and plant on the roof.
        const ang2 = (ang * Math.PI) / 180
        const vx = -Math.sin(ang2)
        const vz = Math.cos(ang2)
        const ux = Math.cos(ang2)
        const uz = Math.sin(ang2)
        out.box('bayDark', Math.min(4.5, len * 0.3), Math.min(3.6, h * 0.72), 0.25, x + vx * (wid / 2) - ux * len * 0.2, Math.min(3.6, h * 0.72) / 2, z + vz * (wid / 2) - uz * len * 0.2, a)
        out.box('steelLight', Math.max(1.6, len * 0.18), 1.1, Math.max(1.4, wid * 0.3), x + ux * len * 0.22, h + 0.9, z + uz * len * 0.22, a)
        out.cyl('steelLight', 0.3, 0.3, 1.8, x - ux * len * 0.3, h + 0.3, z - uz * len * 0.3, 10)
        // A strip of windows along the other long side, and a canopy over the door.
        if (h >= 4.4) out.box('glass', len * 0.62, 0.9, 0.16, x - vx * (wid / 2), h * 0.62, z - vz * (wid / 2), a)
        out.box('roof', Math.min(5.5, len * 0.36), 0.18, 1.8, x + vx * (wid / 2 + 0.9) - ux * len * 0.2, Math.min(3.6, h * 0.72) + 0.4, z + vz * (wid / 2 + 0.9) - uz * len * 0.2, a)
      }
    }
  }
  // Vehicles and containers.
  for (const [x, z, len, wid, ang, h, ci] of MAP.props) {
    const a = (-ang * Math.PI) / 180
    const key = `car${ci}`
    const ux = Math.cos((ang * Math.PI) / 180)
    const uz = Math.sin((ang * Math.PI) / 180)
    if (len < 7 && h < 2.6) {
      // A pickup or a small lift: chassis, body, cab.
      b.box('black', len * 0.92, 0.5, wid * 1.02, x, 0.45, z, a)
      b.box(key, len, 0.75, wid, x, 1.0, z, a)
      b.box(key, len * 0.42, 0.7, wid * 0.94, x + ux * len * 0.08, 1.7, z + uz * len * 0.08, a)
      b.box('glass', len * 0.43, 0.42, wid * 0.96, x + ux * len * 0.08, 1.74, z + uz * len * 0.08, a)
    } else if (len > 13) {
      // A tanker trailer and its tractor.
      b.box('black', len, 0.6, wid * 0.9, x, 0.9, z, a)
      b.tank('tank', 1.25, len - 3.6, x - ux * 1.4, 2.4, z - uz * 1.4, a)
      b.box(key, 2.6, 2.6, wid, x + ux * (len / 2 - 1.3), 2.1, z + uz * (len / 2 - 1.3), a)
    } else if (len < 10) {
      // A truck: cab forward, box body behind.
      b.box('black', len, 0.6, wid * 0.9, x, 0.8, z, a)
      b.box(key, len * 0.68, h - 1.1, wid, x - ux * len * 0.15, 1.1 + (h - 1.1) / 2, z - uz * len * 0.15, a)
      b.box('car0', len * 0.24, 2.0, wid * 0.96, x + ux * len * 0.37, 2.0, z + uz * len * 0.37, a)
    } else {
      // Shipping containers, one or two high.
      b.box(key, len, 2.55, wid, x, 1.3, z, a)
      if (h > 4) b.box(ci === 2 ? 'car1' : 'car2', len, 2.55, wid, x, 3.9, z, a)
    }
  }
  // Crawler cranes: tracks, house, a lattice boom and its back-stay.
  for (const [x, z, heading, L, elev] of MAP.cranes) {
    const th = (heading * Math.PI) / 180
    const el = (elev * Math.PI) / 180
    const a = -th
    const dx = Math.cos(th)
    const dz = Math.sin(th)
    const sx = -dz
    const sz = dx
    for (const s of [-1, 1]) b.box('black', 11, 1.5, 1.7, x + sx * 3.4 * s, 0.75, z + sz * 3.4 * s, a)
    b.box('car2', 9, 3.2, 6, x - dx * 1.5, 3.3, z - dz * 1.5, a)
    b.box('black', 3.4, 2.6, 6.4, x - dx * 6.6, 3.4, z - dz * 6.6, a)
    b.box('glass', 2.2, 2.2, 1.9, x + dx * 2.8 + sx * 2.3, 4.2, z + dz * 2.8 + sz * 2.3, a)
    // Boom: four chords tied by zig-zag lacing.
    const fx = x + dx * 3
    const fz = z + dz * 3
    const fy = 4.6
    const bx = Math.cos(el) * dx
    const by = Math.sin(el)
    const bz = Math.cos(el) * dz
    // A second axis square to the boom and to the sideways axis.
    const px = -Math.sin(el) * dx
    const py = Math.cos(el)
    const pz = -Math.sin(el) * dz
    const hw = 1.05
    const corner = (t: number, i: number): [number, number, number] => {
      const taper = t > L - 6 ? (L - t) / 6 : t < 5 ? t / 5 : 1
      const w = hw * (0.25 + 0.75 * taper)
      const cs = i < 2 ? -1 : 1
      const cp = i % 2 ? -1 : 1
      return [fx + bx * t + (sx * cs + px * cp) * w, fy + by * t + py * cp * w, fz + bz * t + (sz * cs + pz * cp) * w]
    }
    const n = Math.round(L / 4)
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < n; k++) {
        const p0 = corner((k / n) * L, i)
        const p1 = corner(((k + 1) / n) * L, i)
        b.beam('car2', p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.24)
        const q = corner(((k + 1) / n) * L, (i + (k % 2 ? 1 : 3)) % 4)
        b.beam('car2', p0[0], p0[1], p0[2], q[0], q[1], q[2], 0.12)
      }
    }
    const tipX = fx + bx * L
    const tipY = fy + by * L
    const tipZ = fz + bz * L
    // Mast, pendants to the boom tip, back-stay to the counterweight, and the hook line.
    const mx = x - dx * 2
    const mz = z - dz * 2
    b.beam('car2', mx, 5, mz, mx - dx * 7, 27, mz - dz * 7, 0.7)
    for (const s of [-0.5, 0.5]) b.beam('steel', mx - dx * 7 + sx * s, 27, mz - dz * 7 + sz * s, tipX + sx * s, tipY, tipZ + sz * s, 0.1, true)
    b.beam('steel', mx - dx * 7, 27, mz - dz * 7, x - dx * 6.6, 4.8, z - dz * 6.6, 0.14, true)
    b.beam('steel', tipX, tipY, tipZ, tipX, tipY - 24, tipZ, 0.08, true)
    b.box('car3', 1.2, 1.8, 0.8, tipX, tipY - 25, tipZ)
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
      b.box('concreteWall', L, w.h, 1.0, (ax + bx) / 2, w.h / 2, (az + bz) / 2, -Math.atan2(bz - az, bx - ax))
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

/** A flat strip along a centre line: `off` metres to one side of it, `hw` metres either way. */
function ribbon(pos: number[], p: number[], off: number, hw: number, y: number) {
  const n = p.length / 2
  const left: number[] = []
  const right: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1)
    const c = Math.min(n - 1, i + 1)
    // Direction in and direction out, each to unit length; their sum is the
    // direction across the bend.
    let ix = p[i * 2] - p[a * 2]
    let iz = p[i * 2 + 1] - p[a * 2 + 1]
    let ox = p[c * 2] - p[i * 2]
    let oz = p[c * 2 + 1] - p[i * 2 + 1]
    const li = Math.hypot(ix, iz)
    const lo = Math.hypot(ox, oz)
    if (li > 0) {
      ix /= li
      iz /= li
    } else {
      ix = ox / (lo || 1)
      iz = oz / (lo || 1)
    }
    if (lo > 0) {
      ox /= lo
      oz /= lo
    } else {
      ox = ix
      oz = iz
    }
    let dx = ix + ox
    let dz = iz + oz
    const L = Math.hypot(dx, dz) || 1
    dx /= L
    dz /= L
    // Mitre: push the corner out so the ribbon keeps its full width round a
    // bend and does not pinch. Capped so a hairpin does not grow a spike.
    const m = 1 / Math.max(0.5, dx * ix + dz * iz)
    left.push(p[i * 2] - dz * (off + hw) * m, p[i * 2 + 1] + dx * (off + hw) * m)
    right.push(p[i * 2] - dz * (off - hw) * m, p[i * 2 + 1] + dx * (off - hw) * m)
  }
  for (let i = 0; i < n - 1; i++) {
    // Wound so the face normal points up (x east, z south).
    pos.push(left[i * 2], y, left[i * 2 + 1], left[i * 2 + 2], y, left[i * 2 + 3], right[i * 2], y, right[i * 2 + 1])
    pos.push(right[i * 2], y, right[i * 2 + 1], left[i * 2 + 2], y, left[i * 2 + 3], right[i * 2 + 2], y, right[i * 2 + 3])
  }
}

function inRings(polys: number[][][], x: number, z: number): boolean {
  for (const rings of polys) {
    let inside = false
    for (const r of rings) {
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        if (r[i + 1] > z !== r[j + 1] > z && x < ((r[j] - r[i]) * (z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

/**
 * Brush: thick on the lomas and the back dunes, thin over the prairie, none on
 * worked ground, water or the beach. Real geometry, so it casts shadows and
 * slides against the ground as the camera moves.
 */
function vegetation(env: THREE.Texture, bag: Bag, count: number): THREE.InstancedMesh {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 2)
  geo.deleteAttribute('uv')
  geo.deleteAttribute('normal')
  geo = mergeVertices(geo)
  const p = geo.attributes.position
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    // Lumpy, and flattened onto the ground.
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
    const h2 = Math.sin(x * 3.1 + z * 2.3) * Math.cos(y * 2.7 + x * 1.9)
    const k = 0.8 + 0.22 * (h - Math.floor(h)) + 0.2 * h2
    p.setXYZ(i, x * k, Math.max(0, y * k * 0.62 + 0.42), z * k)
    // Darker toward the ground: the inside of a bush is in its own shade.
    const shade = 0.38 + 0.62 * Math.min(1, Math.max(0, y * 0.6 + 0.55))
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, envMap: env, envMapIntensity: 0.6 })
  bag.push(geo, mat)
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  let seed = 31337
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const yard = [MAP.paved[0]]
  const highway = MAP.roads[0].p
  const nearRoad = (x: number, z: number) => {
    for (let i = 0; i + 3 < highway.length; i += 2) {
      const ax = highway[i]
      const az = highway[i + 1]
      const dx = highway[i + 2] - ax
      const dz = highway[i + 3] - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < 10) return true
    }
    return false
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const c = new THREE.Color()
  let n = 0
  for (let tries = 0; n < count && tries < count * 40; tries++) {
    const x = -1000 + rnd() * 1380
    const z = -800 + rnd() * 1600
    const inland = shoreX(z) - x
    if (inland < 78) continue
    if (inRings(yard, x, z) || inRings(MAP.water, x, z) || nearRoad(x, z)) continue
    const scrub = inRings(MAP.scrub, x, z)
    const dune = inland < 240
    const want = scrub ? 0.95 : dune ? 0.55 * (1 - (inland - 78) / 400) : inRings(MAP.tidal, x, z) ? 0.015 : 0.07
    if (rnd() > want) continue
    const big = scrub ? 1.1 + rnd() * rnd() * 3.2 : dune ? 0.7 + rnd() * 1.5 : 0.5 + rnd() * 1.1
    pos.set(x, 0, z)
    q.setFromAxisAngle(up, rnd() * 6.283)
    scl.set(big * (0.8 + rnd() * 0.6), big * (0.55 + rnd() * 0.6), big * (0.8 + rnd() * 0.6))
    mesh.setMatrixAt(n, m.compose(pos, q, scl))
    const t = rnd()
    const dry = dune ? 0.5 + rnd() * 0.5 : rnd() * 0.6
    c.setRGB(0.2 + 0.2 * dry + 0.06 * t, 0.25 + 0.15 * dry + 0.06 * t, 0.13 + 0.12 * dry, THREE.SRGBColorSpace)
    mesh.setColorAt(n, c)
    n++
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.name = 'vegetation'
  return mesh
}

/** Roads as flat ribbons following the mapped centre lines. */
function roads(mats: Mats, bag: Bag): THREE.Group {
  const group = new THREE.Group()
  // Kinds 0 and 1 are the surfaces; 2 and 3 the highway's yellow centre line and white edge lines.
  for (const kind of [0, 1, 2, 3]) {
    const pos: number[] = []
    for (const r of MAP.roads) {
      // Only the highway and streets are asphalt; service roads and tracks are graded dirt.
      if (kind >= 2) {
        if (r.k !== 0 || r.w < 9) continue
        // One centre line, wide enough to hold together from the air. Edge
        // lines a hand's width across only ever showed as flicker.
        if (kind === 2) ribbon(pos, r.p, 0, 0.22, 0.1)
        continue
      }
      if ((r.k === 1 || r.w < 6 ? 1 : 0) !== kind) continue
      ribbon(pos, r.p, 0, r.w / 2, 0.1)
    }
    if (!pos.length) continue
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    // Flat on the ground: every normal is straight up, whichever way the road was drawn.
    const nor = new Float32Array(pos.length)
    for (let i = 1; i < nor.length; i += 3) nor[i] = 1
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    bag.push(geo)
    const mat = (kind === 0 ? mats.asphalt : kind === 1 ? mats.dirt : kind === 2 ? mats.paint : mats.paintEdge) as THREE.MeshStandardMaterial
    // Roads are flat on flat ground. Drawn right after it with no depth test,
    // they can never flicker against it in the distance; everything built
    // later still draws over them.
    mat.depthTest = false
    mat.depthWrite = false
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    // Dirt tracks first, then asphalt over them: where a track leaves a road
    // its square end is covered by the road and does not sit on top of it.
    mesh.renderOrder = kind >= 2 ? -0.5 : kind === 1 ? -1.5 : -1
    group.add(mesh)
  }
  return group
}

export function buildStarbase(env: THREE.Texture, bag: Bag, shared: Weathering, bushes = 2600): StarbaseModel {
  const mats = materials(env, bag, shared)
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
  group.add(vegetation(env, bag, bushes))

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
