/**
 * Moon Base Zero for Touchdown, low-poly but laid out the way the atlas plans
 * it (lib/lunar-atlas/baseplan.ts): a town on a 55 m street grid, three
 * avenues by cross streets, each city block a district for one capability
 * (habitats, power, solar, comms, ISRU, greenhouse, labs, storage, logistics),
 * with Main Avenue running out to the crewed landing pad at one end and the
 * mass driver at the other.
 *
 * Everything static is merged per material, so the whole town is a handful of
 * draw calls.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '@/lib/touchdown/mission'
import type { Bag } from './models'

export type BaseModel = {
  group: THREE.Group
  /** Blinking lights. */
  beacons: THREE.Mesh[]
  /** Footprints for low-sun shadow decals: x, z, width, height. */
  shadows: { x: number; z: number; w: number; h: number }[]
}

const PITCH = 55
const ROAD_W = 9

export function buildMoonBase(
  base: { x: number; y: number; z: number },
  sunSide: number,
  env: THREE.Texture,
  groundAt: (x: number, z: number) => number,
  flag: THREE.Texture | null,
  seed: number,
  bag: Bag
): BaseModel {
  const group = new THREE.Group()
  const beacons: THREE.Mesh[] = []
  const shadows: BaseModel['shadows'] = []
  const rng = mulberry32(seed ^ 0xba5e)
  const track = <T extends { dispose: () => void }>(x: T): T => {
    bag.push(x)
    return x
  }
  const std = (o: THREE.MeshStandardMaterialParameters) =>
    track(new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.8, ...o }))
  const lit = (r: number, g: number, b: number) =>
    track(new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false }))

  const M = {
    hull: std({ color: 0xb4b6bc, metalness: 0.25, roughness: 0.55 }),
    metal: std({ color: 0x9aa0ab, metalness: 1, roughness: 0.36 }),
    dark: std({ color: 0x1d1f23, metalness: 0.6, roughness: 0.6 }),
    foil: std({ color: 0xe0a640, metalness: 1, roughness: 0.4 }),
    panel: std({ color: 0x0b2468, metalness: 0.9, roughness: 0.2 }),
    radiator: std({ color: 0xd8dade, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }),
    orange: std({ color: 0xb5551f, metalness: 0.3, roughness: 0.6 }),
    teal: std({ color: 0x1f6f78, metalness: 0.3, roughness: 0.6 }),
    berm: track(new THREE.MeshLambertMaterial({ color: new THREE.Color(0.19, 0.185, 0.175) })),
    road: track(
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(0.105, 0.102, 0.098),
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    ),
    warm: lit(5, 3.6, 1.8),
    cool: lit(1.6, 3.4, 5),
    grow: lit(4.2, 0.9, 3.4),
    red: lit(7, 0.5, 0.3),
  }
  type MatKey = keyof typeof M
  const parts = new Map<MatKey, THREE.BufferGeometry[]>()

  // Town frame: u runs along the avenues, v across them.
  const rot = 0.32 * (rng() < 0.5 ? -1 : 1)
  const cu = Math.cos(rot)
  const su = Math.sin(rot)
  const world = (u: number, v: number) => {
    const x = base.x + u * cu - v * su
    const z = base.z + u * su + v * cu
    return new THREE.Vector3(x, groundAt(x, z), z)
  }

  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  /** Add a primitive at town coords (u, v), `h` metres above the ground, yawed with the town. */
  const add = (
    mat: MatKey,
    geo: THREE.BufferGeometry,
    u: number,
    v: number,
    h = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    scale: THREE.Vector3 = one
  ) => {
    const p = world(u, v)
    e.set(rx, ry - rot, rz, 'YXZ')
    q.setFromEuler(e)
    m4.compose(p.setY(p.y + h), q, scale)
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    g.applyMatrix4(m4)
    geo.dispose()
    let list = parts.get(mat)
    if (!list) parts.set(mat, (list = []))
    list.push(g)
  }
  const shade = (u: number, v: number, w: number, h: number) => {
    const p = world(u, v)
    shadows.push({ x: p.x, z: p.z, w, h })
  }
  const beacon = (u: number, v: number, h: number, r = 0.5) => {
    const p = world(u, v)
    const b = new THREE.Mesh(track(new THREE.SphereGeometry(r, 8, 6)), M.red)
    b.position.set(p.x, p.y + h, p.z)
    group.add(b)
    beacons.push(b)
  }

  // --- Streets: compacted regolith, draped on the ground -----------------------
  const road = (u0: number, v0: number, u1: number, v1: number, width: number) => {
    const len = Math.hypot(u1 - u0, v1 - v0)
    const n = Math.max(1, Math.ceil(len / 8))
    const du = (u1 - u0) / len
    const dv = (v1 - v0) / len
    const pos: number[] = []
    const row = (k: number) => {
      const t = (k / n) * len
      const a = world(u0 + du * t - dv * (width / 2), v0 + dv * t + du * (width / 2))
      const b = world(u0 + du * t + dv * (width / 2), v0 + dv * t - du * (width / 2))
      return [a, b]
    }
    for (let k = 0; k < n; k++) {
      const [a0, b0] = row(k)
      const [a1, b1] = row(k + 1)
      for (const p of [a0, b0, a1, a1, b0, b1]) pos.push(p.x, p.y + 0.07, p.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
    g.computeVertexNormals()
    let list = parts.get('road')
    if (!list) parts.set('road', (list = []))
    list.push(g)
  }
  const U0 = -2 * PITCH
  const U1 = 2 * PITCH
  const V0 = -1.5 * PITCH
  const V1 = 1.5 * PITCH
  const MAIN_V = -0.5 * PITCH
  for (let k = 0; k <= 3; k++) {
    const v = V0 + k * PITCH
    // Main Avenue runs out past the town to the landing pad and the mass driver.
    if (v === MAIN_V) road(U0 - 42, v, U1 + 150, v, ROAD_W + 2)
    else road(U0, v, U1, v, ROAD_W)
  }
  for (let k = 0; k <= 4; k++) road(U0 + k * PITCH, V0, U0 + k * PITCH, V1, ROAD_W * 0.85)
  // Street lights at every intersection: from 900 m out, this is what reads as a town.
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 3; j++) {
      const u = U0 + i * PITCH + 5.5
      const v = V0 + j * PITCH + 5.5
      add('metal', new THREE.CylinderGeometry(0.09, 0.12, 8, 5), u, v, 4)
      add('warm', new THREE.SphereGeometry(0.4, 8, 6), u, v, 8.2)
    }
  }

  // --- District builders (block centre cu, cv) --------------------------------------
  const habitat = (bu: number, bv: number) => {
    for (const dv of [-11, 11]) {
      add('hull', new THREE.CylinderGeometry(4, 4, 24, 16), bu, bv + dv, 2.2, 0, 0, Math.PI / 2)
      add('berm', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bu, bv + dv, -0.4, 0, 0, 0, new THREE.Vector3(15.5, 5.4, 7.6))
      for (const s of [1, -1]) {
        add('warm', new THREE.CircleGeometry(1.4, 12), bu + s * 12.1, bv + dv, 2.4, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2)
        add('dark', new THREE.BoxGeometry(2.6, 3, 3.4), bu + s * 13.2, bv + dv, 1.5)
      }
      shade(bu, bv + dv, 26, 5.6)
    }
    add('hull', new THREE.CylinderGeometry(1.6, 1.6, 22, 10), bu, bv, 1.6, Math.PI / 2)
  }
  const commons = (bu: number, bv: number) => {
    add('hull', new THREE.IcosahedronGeometry(13, 2), bu, bv, -3.5)
    add('warm', new THREE.CylinderGeometry(12.2, 12.5, 1, 28, 1, true), bu, bv, 1.6)
    add('metal', new THREE.CylinderGeometry(0.4, 0.4, 6, 8), bu, bv, 12)
    beacon(bu, bv, 15.4, 0.45)
    shade(bu, bv, 24, 10)
  }
  const solar = (bu: number, bv: number) => {
    // South-pole arrays stand vertical and face the horizon-hugging sun.
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const u = bu + c * 14
        const v = bv + r * 14
        add('metal', new THREE.CylinderGeometry(0.18, 0.22, 7, 6), u, v, 3.5)
        add('panel', new THREE.BoxGeometry(6.4, 5.6, 0.14), u, v, 4.3, 0, rot + (sunSide > 0 ? 0 : Math.PI))
        add('metal', new THREE.BoxGeometry(6.6, 0.16, 0.2), u, v, 1.45, 0, rot)
        shade(u, v, 6.6, 7.2)
      }
    }
  }
  const power = (bu: number, bv: number) => {
    for (const du of [-13, 0, 13]) {
      add('dark', new THREE.CylinderGeometry(1.5, 1.7, 3.4, 12), bu + du, bv, 1.1)
      add('berm', new THREE.TorusGeometry(4.4, 1.5, 8, 18), bu + du, bv, 0.2, Math.PI / 2)
      for (const a of [-0.9, 0, 0.9]) {
        add('radiator', new THREE.BoxGeometry(0.1, 5.2, 8), bu + du + Math.sin(a) * 4, bv + 9 + Math.cos(a) * 3, 3.6, 0, a)
      }
      add('metal', new THREE.CylinderGeometry(0.12, 0.12, 9, 5), bu + du, bv + 4.5, 2.6, Math.PI / 2)
      shade(bu + du, bv + 9, 8, 6.2)
    }
  }
  const comms = (bu: number, bv: number) => {
    for (const [ox, oz] of [
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
    ]) {
      add('metal', new THREE.CylinderGeometry(0.1, 0.18, 34, 5), bu + ox * 1.2, bv + oz * 1.2, 17, oz * 0.03, 0, -ox * 0.03)
    }
    for (let k = 1; k < 7; k++) add('metal', new THREE.BoxGeometry(2.7 - k * 0.3, 0.1, 2.7 - k * 0.3), bu, bv, k * 5)
    add('hull', new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), bu, bv, 29, Math.PI / 2.3)
    beacon(bu, bv, 34.6)
    shade(bu, bv, 3.2, 34)
    for (const [du, dv, s] of [
      [-15, 12, 4.2],
      [14, -13, 3.4],
    ]) {
      add('metal', new THREE.CylinderGeometry(0.3, 0.5, 4, 8), bu + du, bv + dv, 2)
      add('hull', new THREE.SphereGeometry(s, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), bu + du, bv + dv, 5.2, 2.2, du * 0.1)
      shade(bu + du, bv + dv, s * 2, 7)
    }
    add('hull', new THREE.BoxGeometry(6, 3, 4.5), bu + 10, bv + 12, 1.5)
  }
  const isru = (bu: number, bv: number) => {
    for (const [du, dv] of [
      [-12, -8],
      [-12, 6],
      [-2, -1],
    ]) {
      add('metal', new THREE.SphereGeometry(3.4, 16, 12), bu + du, bv + dv, 4.2)
      add('dark', new THREE.CylinderGeometry(0.2, 0.2, 2.4, 6), bu + du, bv + dv, 1)
      shade(bu + du, bv + dv, 6.6, 7.4)
    }
    add('orange', new THREE.BoxGeometry(9, 5.5, 7), bu + 12, bv + 4, 2.75)
    add('dark', new THREE.CylinderGeometry(1.1, 1.1, 9, 10), bu + 12, bv + 4, 9)
    add('metal', new THREE.CylinderGeometry(0.22, 0.22, 16, 6), bu + 3, bv + 5, 4.4, 0, 0, Math.PI / 2)
    add('metal', new THREE.BoxGeometry(14, 0.5, 1.4), bu + 12, bv - 10, 3, 0, 0, 0.28)
    add('berm', new THREE.ConeGeometry(4.5, 3.4, 12), bu + 19, bv - 10, 1.7)
    shade(bu + 12, bv + 4, 9, 13)
  }
  const greenhouse = (bu: number, bv: number) => {
    for (const dv of [-10, 0, 10]) {
      add('grow', new THREE.CylinderGeometry(3.4, 3.4, 30, 14, 1, false, 0, Math.PI), bu, bv + dv, 0.1, 0, Math.PI / 2, Math.PI / 2)
      for (let k = -3; k <= 3; k++) {
        add('metal', new THREE.TorusGeometry(3.45, 0.09, 5, 14, Math.PI), bu + k * 5, bv + dv, 0.1, 0, Math.PI / 2)
      }
      shade(bu, bv + dv, 30, 3.6)
    }
  }
  const labs = (bu: number, bv: number) => {
    for (const [du, dv, ry] of [
      [-10, -8, 0],
      [9, 7, Math.PI / 2],
    ]) {
      add('hull', new THREE.BoxGeometry(16, 4.4, 6.5), bu + du, bv + dv, 4)
      add('cool', new THREE.BoxGeometry(12, 0.7, 6.6), bu + du, bv + dv, 4.4)
      for (const s of [-6, 6]) add('metal', new THREE.CylinderGeometry(0.2, 0.2, 2, 6), bu + du + s, bv + dv, 1)
      shade(bu + du, bv + dv, 16, 6.4)
      void ry
    }
    add('foil', new THREE.BoxGeometry(4, 3, 4), bu + 10, bv - 10, 1.5)
  }
  const storage = (bu: number, bv: number) => {
    for (let r = -1; r <= 1; r++) {
      for (const du of [-9, 9]) {
        add('metal', new THREE.CylinderGeometry(2.3, 2.3, 13, 14), bu + du, bv + r * 9, 2.9, 0, 0, Math.PI / 2)
        add('dark', new THREE.BoxGeometry(1, 0.8, 5), bu + du - 4, bv + r * 9, 0.4)
        add('dark', new THREE.BoxGeometry(1, 0.8, 5), bu + du + 4, bv + r * 9, 0.4)
        shade(bu + du, bv + r * 9, 13, 5.4)
      }
    }
  }
  const logistics = (bu: number, bv: number) => {
    const colours: MatKey[] = ['orange', 'teal', 'hull', 'foil']
    for (let k = 0; k < 9; k++) {
      const du = -14 + (k % 3) * 7
      const dv = -12 + Math.floor(k / 3) * 5
      const stack = 1 + Math.floor(rng() * 2.4)
      for (let s = 0; s < stack; s++) {
        add(colours[Math.floor(rng() * colours.length)], new THREE.BoxGeometry(6, 2.5, 2.5), bu + du, bv + dv, 1.25 + s * 2.55)
      }
      shade(bu + du, bv + dv, 6, stack * 2.6)
    }
    // Gantry crane
    add('metal', new THREE.CylinderGeometry(0.3, 0.4, 16, 6), bu + 14, bv + 8, 8)
    add('metal', new THREE.BoxGeometry(18, 0.6, 0.6), bu + 7, bv + 8, 15.6)
    add('dark', new THREE.CylinderGeometry(0.05, 0.05, 7, 4), bu + 1, bv + 8, 12)
    shade(bu + 14, bv + 8, 1, 16)
  }
  const garage = (bu: number, bv: number) => {
    add('hull', new THREE.CylinderGeometry(9, 9, 22, 16, 1, true, 0, Math.PI), bu, bv, 0, 0, Math.PI / 2, Math.PI / 2)
    add('dark', new THREE.PlaneGeometry(17.8, 8.6), bu - 11, bv, 4.2, 0, -Math.PI / 2)
    add('cool', new THREE.BoxGeometry(0.2, 0.3, 14), bu + 11.1, bv, 6)
    shade(bu, bv, 22, 9)
  }
  const rover = (u: number, v: number, yaw: number) => {
    add('hull', new THREE.BoxGeometry(4.4, 1.5, 2.4), u, v, 1.6, 0, yaw)
    add('panel', new THREE.BoxGeometry(1.8, 1.1, 2.1), u, v, 2.8, 0, yaw)
    for (const [du, dv] of [
      [-1.5, 1.3],
      [1.5, 1.3],
      [-1.5, -1.3],
      [1.5, -1.3],
    ]) {
      add('dark', new THREE.CylinderGeometry(0.7, 0.7, 0.5, 10), u + du, v + dv, 0.7, Math.PI / 2)
    }
    add('cool', new THREE.SphereGeometry(0.16, 6, 5), u + 2.25, v, 1.5)
    shade(u, v, 4.4, 3.4)
  }

  // --- Zoning: 4 blocks along, 3 across ----------------------------------------------
  const blocks: ((u: number, v: number) => void)[][] = [
    [solar, solar, power, logistics],
    [habitat, commons, isru, comms],
    [greenhouse, labs, storage, garage],
  ]
  blocks.forEach((rowBlocks, j) =>
    rowBlocks.forEach((build, i) => build(U0 + (i + 0.5) * PITCH, V0 + (j + 0.5) * PITCH))
  )
  rover(U0 + 30, MAIN_V + 2, 0)
  rover(U1 - 46, MAIN_V - 2, Math.PI)
  rover(U0 - 24, MAIN_V + 2, 0)
  rover(U0 + PITCH + 3, V1 - 20, Math.PI / 2)

  // --- Crewed landing pad at the end of Main Avenue ----------------------------------------
  {
    // Kept close to town, well clear of the game's landing zone.
    const pu = U0 - 74
    const pv = MAIN_V
    add('dark', new THREE.CylinderGeometry(30, 30, 0.3, 40), pu, pv, 0.15)
    add('berm', new THREE.TorusGeometry(35, 3.2, 8, 40), pu, pv, 0.2, Math.PI / 2, 0, 0, new THREE.Vector3(1, 1, 0.8))
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      add('cool', new THREE.SphereGeometry(0.36, 6, 5), pu + Math.cos(a) * 28, pv + Math.sin(a) * 28, 0.5)
    }
    // A tall crew lander standing on the pad.
    add('hull', new THREE.CylinderGeometry(4.5, 4.5, 34, 24), pu, pv, 21)
    add('hull', new THREE.SphereGeometry(4.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pu, pv, 38, 0, 0, 0, new THREE.Vector3(1, 2.1, 1))
    add('dark', new THREE.CylinderGeometry(4.55, 4.55, 1.2, 24), pu, pv, 30)
    add('dark', new THREE.CylinderGeometry(3.6, 4.4, 3, 20), pu, pv, 3.2)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.6
      add('metal', new THREE.CylinderGeometry(0.3, 0.3, 9, 6), pu + Math.cos(a) * 5.4, pv + Math.sin(a) * 5.4, 3.6, 0, -a, 0.45)
      add('dark', new THREE.CylinderGeometry(1, 1, 0.3, 10), pu + Math.cos(a) * 7.2, pv + Math.sin(a) * 7.2, 0.3)
    }
    add('metal', new THREE.BoxGeometry(1.2, 20, 1.2), pu + 5.2, pv, 12)
    beacon(pu, pv, 48, 0.55)
    shade(pu, pv, 9.5, 47)
  }

  // --- Mass driver at the other end ---------------------------------------------------------
  {
    const u0 = U1 + 34
    const len = 120
    add('dark', new THREE.BoxGeometry(len, 1.1, 2.2), u0 + len / 2, MAIN_V + 16, 5.5, 0, 0, 0.055)
    for (let k = 0; k <= 12; k++) {
      const u = u0 + (k / 12) * len
      const h = 2.2 + (k / 12) * 6.6
      add('metal', new THREE.CylinderGeometry(0.22, 0.3, h, 6), u, MAIN_V + 16, h / 2)
      add('foil', new THREE.TorusGeometry(1.9, 0.22, 6, 16), u, MAIN_V + 16, h + 0.6, 0, Math.PI / 2)
    }
    add('hull', new THREE.BoxGeometry(10, 5, 8), u0 - 4, MAIN_V + 16, 2.5)
    shade(u0 + len / 2, MAIN_V + 16, len, 6)
  }

  // --- The flag, on the town square ---------------------------------------------------------
  {
    const p = world(-6, MAIN_V + 9)
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 9, 5)), M.metal)
    pole.position.set(p.x, p.y + 4.5, p.z)
    const cloth = new THREE.Mesh(
      track(new THREE.PlaneGeometry(4.6, 2.8)),
      flag ? track(new THREE.MeshBasicMaterial({ map: flag, side: THREE.DoubleSide, toneMapped: false })) : M.hull
    )
    cloth.position.set(p.x + 2.35, p.y + 7.4, p.z)
    group.add(pole, cloth)
    shade(-6, MAIN_V + 9, 0.4, 9)
  }

  parts.forEach((list, key) => {
    const merged = mergeGeometries(list, false)
    for (const g of list) g.dispose()
    if (!merged) return
    track(merged)
    const mesh = new THREE.Mesh(merged, M[key])
    mesh.receiveShadow = key === 'road'
    group.add(mesh)
  })
  return { group, beacons, shadows }
}
