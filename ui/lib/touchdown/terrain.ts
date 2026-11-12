/**
 * Seeded landing-site terrain for Touchdown.
 *
 * Three nested levels, all from one seed:
 *   - OUTER: a stretched grid out to ~60 km with massifs and big craters, so
 *     the Moon runs to a real horizon. Visual only.
 *   - COARSE: the 2.4 km flight area at 6 m cells, with power-law craters.
 *   - FINE: a 240 m patch at 1 m cells around the pad, with small craters and
 *     mounds, so landing near the pad but not on it can tip the lander.
 *
 * Low-sun shadows are baked for all three in one sweep per column (the sun
 * sits on the ±z side), each level inheriting the horizon line of the one
 * outside it, so distant mountains shadow the landing site.
 *
 * Collision queries sample the height exactly as the render meshes are
 * triangulated, so footpads never float or sink.
 *
 * Dependency-free: imported by the headless bot.
 */
import { baseColliders } from './baseLayout'
import { mulberry32, type Rng } from './mission'

export const MAP_SIZE = 2400
export const GRID_N = 401
export const CELL = MAP_SIZE / (GRID_N - 1)
const HALF = MAP_SIZE / 2

export const FINE_SIZE = 240
export const FINE_CELL = 1
export const FINE_N = FINE_SIZE / FINE_CELL + 1
/** Fine patch half-width in coarse cells. */
export const FINE_HALF_CELLS = FINE_SIZE / 2 / CELL

export const MOON_RADIUS = 1_737_400
const OUTER_EXTENT = 60_000

const BOULDER_GRID_CELL = 8
const BOULDER_GRID_N = Math.ceil(MAP_SIZE / BOULDER_GRID_CELL)

export type Crater = { x: number; z: number; r: number; depth: number; rim: number }

export type Terrain = {
  seed: number
  heights: Float32Array
  /** 0 = in baked shadow, 1 = sunlit. One value per coarse vertex. */
  sun: Float32Array
  craters: Crater[]
  /** Unit vector pointing TOWARD the sun. Always in the y/z plane. */
  sunDir: [number, number, number]
  sunElevationDeg: number
  target: { x: number; y: number; z: number }
  /** Centre of Moon Base Zero, a few hundred metres past the pad. */
  base: { x: number; y: number; z: number }
  /** Fine patch: FINE_N² heights + sun, origin at (fineX0, fineZ0). */
  fine: Float32Array
  fineSun: Float32Array
  fineX0: number
  fineZ0: number
  /** Outer grid: `outerCoords` (K) is used for both x and z; K² heights + sun. */
  outerCoords: Float32Array
  outerHeights: Float32Array
  outerSun: Float32Array
  boulderCount: number
  /** x, y, z, radius per boulder (y is the sphere centre). */
  boulders: Float32Array
  boulderCellStart: Int32Array
  boulderCellItems: Int32Array
  /** Moon Base Zero's solid parts as spheres: x, y, z, radius (see baseLayout.ts). */
  structures: Float32Array
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Seeded 2D value noise. */
function makeNoise(rng: Rng) {
  const table = new Float32Array(256 * 256)
  for (let i = 0; i < table.length; i++) table[i] = rng() * 2 - 1
  const at = (ix: number, iz: number) => table[((iz & 255) << 8) | (ix & 255)]
  return (x: number, z: number) => {
    const ix = Math.floor(x)
    const iz = Math.floor(z)
    const fx = x - ix
    const fz = z - iz
    const u = fx * fx * (3 - 2 * fx)
    const v = fz * fz * (3 - 2 * fz)
    const a = at(ix, iz)
    const b = at(ix + 1, iz)
    const c = at(ix, iz + 1)
    const d = at(ix + 1, iz + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

function craterProfile(d: number, depth: number, rim: number): number {
  if (d < 1) return (depth + rim) * d * d - depth
  return rim * Math.exp(-(d - 1) / 0.32) * (1 - smoothstep(1.8, 2.4, d))
}

/** Triangulated sample of a square grid (split along the +x/+z diagonal). */
function sampleGrid(h: Float32Array, n: number, cell: number, x0: number, z0: number, x: number, z: number): number {
  const gx = (x - x0) / cell
  const gz = (z - z0) / cell
  const i = Math.min(n - 2, Math.max(0, Math.floor(gx)))
  const j = Math.min(n - 2, Math.max(0, Math.floor(gz)))
  const fx = Math.min(1, Math.max(0, gx - i))
  const fz = Math.min(1, Math.max(0, gz - j))
  const k = j * n + i
  const h00 = h[k]
  const h10 = h[k + 1]
  const h01 = h[k + n]
  const h11 = h[k + n + 1]
  if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00)
  return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11)
}

function normalGrid(h: Float32Array, n: number, cell: number, x0: number, z0: number, x: number, z: number, out: number[]) {
  const gx = (x - x0) / cell
  const gz = (z - z0) / cell
  const i = Math.min(n - 2, Math.max(0, Math.floor(gx)))
  const j = Math.min(n - 2, Math.max(0, Math.floor(gz)))
  const k = j * n + i
  const h00 = h[k]
  const h10 = h[k + 1]
  const h01 = h[k + n]
  const h11 = h[k + n + 1]
  let sx: number
  let sz: number
  if (gx - i + (gz - j) <= 1) {
    sx = (h10 - h00) / cell
    sz = (h01 - h00) / cell
  } else {
    sx = (h11 - h01) / cell
    sz = (h11 - h10) / cell
  }
  const inv = 1 / Math.sqrt(sx * sx + 1 + sz * sz)
  out[0] = -sx * inv
  out[1] = inv
  out[2] = -sz * inv
}

function bilinear(a: Float32Array, n: number, gx: number, gz: number): number {
  const cx = Math.min(n - 1.001, Math.max(0, gx))
  const cz = Math.min(n - 1.001, Math.max(0, gz))
  const i = Math.floor(cx)
  const j = Math.floor(cz)
  const fx = cx - i
  const fz = cz - j
  const k = j * n + i
  const p = a[k] + (a[k + 1] - a[k]) * fx
  const q = a[k + n] + (a[k + n + 1] - a[k + n]) * fx
  return p + (q - p) * fz
}

export function generateTerrain(seed: number): Terrain {
  const rng = mulberry32(seed)
  const N = GRID_N

  // --- Large-scale relief: a plain ringed by massifs --------------------------
  const bigNoise = makeNoise(rng)
  const bo = [rng() * 200, rng() * 200]
  const bigCraters: Crater[] = []
  for (let c = 0; c < 46; c++) {
    const a = rng() * Math.PI * 2
    const d = 2600 + Math.pow(rng(), 0.7) * 44000
    const r = Math.min(d * 0.42, 350 + Math.pow(rng(), 2.2) * 5200)
    const depth = Math.min(900, r * (0.2 - 0.09 * smoothstep(800, 5000, r)))
    bigCraters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth, rim: depth * 0.28 })
  }
  const bigHeight = (x: number, z: number): number => {
    const d = Math.sqrt(x * x + z * z)
    const mask = smoothstep(1500, 7000, d)
    let h = 0
    if (mask > 0) {
      const n1 = bigNoise(bo[0] + x / 5200, bo[1] + z / 5200)
      const n2 = bigNoise(bo[0] + x / 2300, bo[1] + z / 2300)
      const n3 = bigNoise(bo[0] + x / 1000, bo[1] + z / 1000)
      const n4 = bigNoise(bo[0] + x / 430, bo[1] + z / 430)
      // Ridged first octave: sharp-crested massifs rather than rolling hills.
      const ridge = 1 - Math.abs(n1)
      h = mask * (720 * ridge * ridge - 150 + 300 * n2 + 120 * n3 + 45 * n4)
    }
    for (let c = 0; c < bigCraters.length; c++) {
      const k = bigCraters[c]
      const dx = x - k.x
      const dz = z - k.z
      const q = dx * dx + dz * dz
      const reach = k.r * 2.4
      if (q < reach * reach) h += craterProfile(Math.sqrt(q) / k.r, k.depth, k.rim)
    }
    return h
  }

  // --- Sun -----------------------------------------------------------------------
  // On the ±z side (across the approach track): craters read by their shadows,
  // the lander is side-lit, and the shadow bake is one sweep per column.
  const sunSide = rng() < 0.5 ? 1 : -1
  const sunElevationDeg = 7 + rng() * 5
  const elev = (sunElevationDeg * Math.PI) / 180
  const tanE = Math.tan(elev)
  const sunDir: [number, number, number] = [0, Math.sin(elev), sunSide * Math.cos(elev)]

  // --- OUTER grid ----------------------------------------------------------------
  const inner = HALF - 12
  const pos: number[] = []
  let step = 24
  for (let c = inner; c < OUTER_EXTENT; c += step) {
    pos.push(c)
    step *= 1.05
  }
  pos.push(OUTER_EXTENT)
  const mid: number[] = []
  const MID = 12
  for (let i = 1; i < MID; i++) mid.push(-inner + (i / MID) * inner * 2)
  const coords = [...pos.slice().reverse().map((v) => -v), ...mid, ...pos]
  const K = coords.length
  const outerCoords = new Float32Array(coords)
  const outerHeights = new Float32Array(K * K)
  for (let j = 0; j < K; j++) {
    for (let i = 0; i < K; i++) outerHeights[j * K + i] = bigHeight(coords[i], coords[j])
  }
  const outerSun = new Float32Array(K * K)
  const outerLine = new Float32Array(K * K)
  for (let i = 0; i < K; i++) {
    let line = -1e9
    for (let s = 0; s < K; s++) {
      const j = sunSide > 0 ? K - 1 - s : s
      if (s > 0) {
        const prev = sunSide > 0 ? j + 1 : j - 1
        line -= Math.abs(coords[j] - coords[prev]) * tanE
      }
      const h = outerHeights[j * K + i]
      if (h >= line) {
        line = h
        outerSun[j * K + i] = 1
      } else {
        outerSun[j * K + i] = 1 - Math.min(1, (line - h) / 14)
      }
      outerLine[j * K + i] = line
    }
  }
  /** Horizon line (shadow ceiling) from the outer bake at a point, bilinear on the stretched grid. */
  const outerLineAt = (x: number, z: number): number => {
    const find = (v: number) => {
      let lo = 0
      let hi = K - 2
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1
        if (coords[m] <= v) lo = m
        else hi = m - 1
      }
      return lo
    }
    const i = find(x)
    const j = find(z)
    const fx = (x - coords[i]) / (coords[i + 1] - coords[i])
    const fz = (z - coords[j]) / (coords[j + 1] - coords[j])
    const a = outerLine[j * K + i] + (outerLine[j * K + i + 1] - outerLine[j * K + i]) * fx
    const b = outerLine[(j + 1) * K + i] + (outerLine[(j + 1) * K + i + 1] - outerLine[(j + 1) * K + i]) * fx
    return a + (b - a) * fz
  }

  // --- COARSE flight area -----------------------------------------------------------
  const heights = new Float32Array(N * N)
  const noise = makeNoise(rng)
  const ox = rng() * 100
  const oz = rng() * 100
  for (let j = 0; j < N; j++) {
    const z = -HALF + j * CELL
    for (let i = 0; i < N; i++) {
      const x = -HALF + i * CELL
      let h = 0
      let amp = 15
      let freq = 1 / 520
      for (let o = 0; o < 5; o++) {
        h += noise(ox + x * freq, oz + z * freq) * amp
        amp *= 0.46
        freq *= 2.1
      }
      heights[j * N + i] = h
    }
  }
  const craters: Crater[] = []
  for (let c = 0; c < 560; c++) {
    const r = Math.min(170, 9 * Math.pow(1 - rng() * 0.985, -1 / 1.55))
    const x = (rng() - 0.5) * (MAP_SIZE - 200)
    const z = (rng() - 0.5) * (MAP_SIZE - 200)
    const depth = Math.min(24, r * (0.2 - 0.05 * smoothstep(40, 170, r)))
    const rim = depth * 0.22
    craters.push({ x, z, r, depth, rim })
    const reach = r * 2.4
    const i0 = Math.max(0, Math.floor((x - reach + HALF) / CELL))
    const i1 = Math.min(N - 1, Math.ceil((x + reach + HALF) / CELL))
    const j0 = Math.max(0, Math.floor((z - reach + HALF) / CELL))
    const j1 = Math.min(N - 1, Math.ceil((z + reach + HALF) / CELL))
    for (let j = j0; j <= j1; j++) {
      const dz = -HALF + j * CELL - z
      for (let i = i0; i <= i1; i++) {
        const dx = -HALF + i * CELL - x
        const d = Math.sqrt(dx * dx + dz * dz) / r
        if (d < 2.4) heights[j * N + i] += craterProfile(d, depth, rim)
      }
    }
  }
  // Local detail fades out at the border, where the large-scale relief takes over.
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const edge = Math.min(i, j, N - 1 - i, N - 1 - j) * CELL
      heights[j * N + i] =
        heights[j * N + i] * smoothstep(0, 200, edge) + bigHeight(-HALF + i * CELL, -HALF + j * CELL)
    }
  }

  // --- COARSE shadow bake, inheriting the outer horizon ----------------------------------------
  const sun = new Float32Array(N * N)
  const lineArr = new Float32Array(N * N)
  const drop = CELL * tanE
  const bakeCoarse = () => {
    for (let i = 0; i < N; i++) {
      const x = -HALF + i * CELL
      let line = outerLineAt(Math.max(-inner, Math.min(inner, x)), sunSide * HALF) + drop
      for (let s = 0; s < N; s++) {
        const j = sunSide > 0 ? N - 1 - s : s
        const h = heights[j * N + i]
        line -= drop
        if (h >= line) {
          line = h
          sun[j * N + i] = 1
        } else {
          sun[j * N + i] = 1 - Math.min(1, (line - h) / 0.9)
        }
        lineArr[j * N + i] = line
      }
    }
  }
  bakeCoarse()

  // --- Target: flattest sunlit spot near the centre -------------------------------------
  let best = Infinity
  let ti = (N - 1) / 2
  let tj = (N - 1) / 2
  const R = 3
  const c0 = (N - 1) / 2
  for (let j = c0 - 22; j <= c0 + 22; j += 2) {
    for (let i = c0 - 22; i <= c0 + 22; i += 2) {
      let lo = Infinity
      let hi = -Infinity
      let lit = 0
      let n = 0
      for (let dj = -R; dj <= R; dj++) {
        for (let di = -R; di <= R; di++) {
          const h = heights[(j + dj) * N + (i + di)]
          if (h < lo) lo = h
          if (h > hi) hi = h
          lit += sun[(j + dj) * N + (i + di)]
          n++
        }
      }
      // A pad in shadow is hard to judge from above: strongly prefer sunlit ground.
      const cost = hi - lo + (1 - lit / n) * 8
      if (cost < best) {
        best = cost
        ti = i
        tj = j
      }
    }
  }
  const tx = -HALF + ti * CELL
  const tz = -HALF + tj * CELL

  // --- Moon Base Zero site: levelled ground past the pad -----------------------------------
  const baseX = tx + 345 + rng() * 50
  const baseZ = tz + (rng() < 0.5 ? -1 : 1) * (70 + rng() * 60)
  const baseH = sampleGrid(heights, N, CELL, -HALF, -HALF, baseX, baseZ)
  {
    const reach = 330
    const i0 = Math.max(0, Math.floor((baseX - reach + HALF) / CELL))
    const i1 = Math.min(N - 1, Math.ceil((baseX + reach + HALF) / CELL))
    const j0 = Math.max(0, Math.floor((baseZ - reach + HALF) / CELL))
    const j1 = Math.min(N - 1, Math.ceil((baseZ + reach + HALF) / CELL))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(-HALF + i * CELL - baseX, -HALF + j * CELL - baseZ)
        const w = 1 - smoothstep(215, reach, d)
        heights[j * N + i] += (baseH - heights[j * N + i]) * w
      }
    }
  }

  // The base pad changed the ground, so bake again.
  bakeCoarse()

  // --- FINE patch around the pad ----------------------------------------------------------------
  const fineX0 = tx - FINE_SIZE / 2
  const fineZ0 = tz - FINE_SIZE / 2
  const FN = FINE_N
  const fine = new Float32Array(FN * FN)
  const fineNoise = makeNoise(rng)
  const small: Crater[] = []
  for (let c = 0; c < 95; c++) {
    const r = Math.min(11, 1.8 * Math.pow(1 - rng() * 0.96, -1 / 1.6))
    const x = tx + (rng() - 0.5) * (FINE_SIZE - 30)
    const z = tz + (rng() - 0.5) * (FINE_SIZE - 30)
    // Keep the bullseye itself clear; everything around it is fair game.
    if (Math.hypot(x - tx, z - tz) - r * 1.4 < 6) continue
    const depth = r * 0.24
    small.push({ x, z, r, depth, rim: depth * 0.3 })
  }
  for (let j = 0; j < FN; j++) {
    const z = fineZ0 + j * FINE_CELL
    for (let i = 0; i < FN; i++) {
      const x = fineX0 + i * FINE_CELL
      const baseHeight = sampleGrid(heights, N, CELL, -HALF, -HALF, x, z)
      let d = 0.42 * fineNoise(x / 13, z / 13) + 0.16 * fineNoise(x / 4.1 + 40, z / 4.1) + 0.05 * fineNoise(x / 1.3, z / 1.3 + 9)
      for (let c = 0; c < small.length; c++) {
        const k = small[c]
        const dx = x - k.x
        const dz = z - k.z
        const q = dx * dx + dz * dz
        const reach = k.r * 2.4
        if (q < reach * reach) d += craterProfile(Math.sqrt(q) / k.r, k.depth, k.rim)
      }
      const edge = Math.min(i, j, FN - 1 - i, FN - 1 - j) * FINE_CELL
      const pad = smoothstep(4.5, 9, Math.hypot(x - tx, z - tz))
      // On the patch border the detail is exactly zero, so the fine mesh meets
      // the coarse mesh with no crack.
      fine[j * FN + i] = baseHeight + d * smoothstep(0, 22, edge) * pad
    }
  }
  const fineSun = new Float32Array(FN * FN)
  const fdrop = FINE_CELL * tanE
  for (let i = 0; i < FN; i++) {
    const gx = (fineX0 + i * FINE_CELL + HALF) / CELL
    const edgeJ = sunSide > 0 ? FN - 1 : 0
    const gz = (fineZ0 + edgeJ * FINE_CELL + HALF) / CELL
    let line = bilinear(lineArr, N, gx, gz) + fdrop
    for (let s = 0; s < FN; s++) {
      const j = sunSide > 0 ? FN - 1 - s : s
      const h = fine[j * FN + i]
      line -= fdrop
      if (h >= line - 0.02) {
        line = Math.max(line, h)
        fineSun[j * FN + i] = 1
      } else {
        fineSun[j * FN + i] = 1 - Math.min(1, (line - h) / 0.25)
      }
    }
  }

  const terrain: Terrain = {
    seed,
    heights,
    sun,
    craters,
    sunDir,
    sunElevationDeg,
    target: { x: tx, y: 0, z: tz },
    base: { x: baseX, y: baseH, z: baseZ },
    fine,
    fineSun,
    fineX0,
    fineZ0,
    outerCoords,
    outerHeights,
    outerSun,
    boulderCount: 0,
    boulders: new Float32Array(0),
    boulderCellStart: new Int32Array(0),
    boulderCellItems: new Int32Array(0),
    structures: new Float32Array(0),
  }
  terrain.target.y = heightAt(terrain, tx, tz)

  // --- Boulders -------------------------------------------------------------------------------------
  const data: number[] = []
  const place = (x: number, z: number, r: number) => {
    if (Math.abs(x) > HALF - 40 || Math.abs(z) > HALF - 40) return
    if (Math.hypot(x - tx, z - tz) < 5.5 + r) return
    if (Math.hypot(x - baseX, z - baseZ) < 250) return
    data.push(x, heightAt(terrain, x, z) + r * 0.35, z, r)
  }
  const rimCraters = craters.filter((c) => c.r > 16)
  for (let b = 0; b < 3000; b++) {
    let x: number
    let z: number
    if (rng() < 0.75 && rimCraters.length) {
      const c = rimCraters[Math.floor(rng() * rimCraters.length)]
      const a = rng() * Math.PI * 2
      const d = c.r * (0.88 + rng() * 0.42)
      x = c.x + Math.cos(a) * d
      z = c.z + Math.sin(a) * d
    } else {
      x = (rng() - 0.5) * (MAP_SIZE - 120)
      z = (rng() - 0.5) * (MAP_SIZE - 120)
    }
    place(x, z, Math.min(3.6, 0.35 * Math.pow(1 - rng() * 0.97, -1 / 1.7)))
  }
  // The landing zone itself: rocks big enough to catch a footpad, thickest in
  // the ring just outside the bullseye.
  for (let b = 0; b < 120; b++) {
    const a = rng() * Math.PI * 2
    const d = 7.5 + Math.pow(rng(), 1.3) * 105
    place(tx + Math.cos(a) * d, tz + Math.sin(a) * d, Math.min(1.7, 0.28 * Math.pow(1 - rng() * 0.95, -1 / 1.9)))
  }
  // ...and a few thrown out around the small craters' rims.
  for (const c of small) {
    if (c.r < 3.5) continue
    const n = 1 + Math.floor(rng() * 3)
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2
      const d = c.r * (0.95 + rng() * 0.5)
      place(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0.25 + rng() * 0.55)
    }
  }
  terrain.boulders = new Float32Array(data)
  terrain.boulderCount = data.length / 4

  // Counting-sort the boulders into a uniform grid.
  const G = BOULDER_GRID_N
  const counts = new Int32Array(G * G + 1)
  const cellOf = (x: number, z: number) => {
    const cx = Math.min(G - 1, Math.max(0, Math.floor((x + HALF) / BOULDER_GRID_CELL)))
    const cz = Math.min(G - 1, Math.max(0, Math.floor((z + HALF) / BOULDER_GRID_CELL)))
    return cz * G + cx
  }
  for (let b = 0; b < terrain.boulderCount; b++) {
    counts[cellOf(terrain.boulders[b * 4], terrain.boulders[b * 4 + 2]) + 1]++
  }
  for (let i = 0; i < G * G; i++) counts[i + 1] += counts[i]
  const items = new Int32Array(terrain.boulderCount)
  const cursor = counts.slice(0, G * G)
  for (let b = 0; b < terrain.boulderCount; b++) {
    const c = cellOf(terrain.boulders[b * 4], terrain.boulders[b * 4 + 2])
    items[cursor[c]++] = b
  }
  terrain.boulderCellStart = counts
  terrain.boulderCellItems = items

  // Moon Base Zero's solid parts, on the ground as it now stands.
  terrain.structures = baseColliders(seed, terrain.base, (x, z) => heightAt(terrain, x, z))

  return terrain
}

function inFine(t: Terrain, x: number, z: number): boolean {
  return x >= t.fineX0 && z >= t.fineZ0 && x <= t.fineX0 + FINE_SIZE && z <= t.fineZ0 + FINE_SIZE
}

/** Ground height, sampled on the same triangles as the render meshes. */
export function heightAt(t: Terrain, x: number, z: number): number {
  if (inFine(t, x, z)) return sampleGrid(t.fine, FINE_N, FINE_CELL, t.fineX0, t.fineZ0, x, z)
  if (x < -HALF || z < -HALF || x > HALF || z > HALF) return outerHeightAt(t, x, z)
  return sampleGrid(t.heights, GRID_N, CELL, -HALF, -HALF, x, z)
}

/** Height on the outer (horizon) grid. Visual only; coarse. */
export function outerHeightAt(t: Terrain, x: number, z: number): number {
  const c = t.outerCoords
  const K = c.length
  const find = (v: number) => {
    let lo = 0
    let hi = K - 2
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1
      if (c[m] <= v) lo = m
      else hi = m - 1
    }
    return lo
  }
  const i = find(x)
  const j = find(z)
  const fx = Math.min(1, Math.max(0, (x - c[i]) / (c[i + 1] - c[i])))
  const fz = Math.min(1, Math.max(0, (z - c[j]) / (c[j + 1] - c[j])))
  const h = t.outerHeights
  const a = h[j * K + i] + (h[j * K + i + 1] - h[j * K + i]) * fx
  const b = h[(j + 1) * K + i] + (h[(j + 1) * K + i + 1] - h[(j + 1) * K + i]) * fx
  return a + (b - a) * fz
}

/** Unit ground normal of the triangle under (x, z). Writes into `out`. */
export function normalAt(t: Terrain, x: number, z: number, out: number[]): void {
  if (inFine(t, x, z)) {
    normalGrid(t.fine, FINE_N, FINE_CELL, t.fineX0, t.fineZ0, x, z, out)
    return
  }
  if (x < -HALF || z < -HALF || x > HALF || z > HALF) {
    out[0] = 0
    out[1] = 1
    out[2] = 0
    return
  }
  normalGrid(t.heights, GRID_N, CELL, -HALF, -HALF, x, z, out)
}

/** Baked sunlight (0..1) at a point, bilinear. */
export function sunAt(t: Terrain, x: number, z: number): number {
  if (inFine(t, x, z)) {
    return bilinear(t.fineSun, FINE_N, (x - t.fineX0) / FINE_CELL, (z - t.fineZ0) / FINE_CELL)
  }
  return bilinear(t.sun, GRID_N, (x + HALF) / CELL, (z + HALF) / CELL)
}

export type Contact = {
  depth: number
  nx: number
  ny: number
  nz: number
  boulder: boolean
  /** Index of the base structure hit, or -1. */
  structure: number
}

/**
 * Deepest penetration of a point into the ground or a boulder.
 * Returns false when the point is clear. `out.depth` is positive when inside.
 */
export function contactAt(t: Terrain, x: number, y: number, z: number, out: Contact): boolean {
  let hit = false
  const h = heightAt(t, x, z)
  if (y < h) {
    const n = scratchN
    normalAt(t, x, z, n)
    out.depth = (h - y) * n[1]
    out.nx = n[0]
    out.ny = n[1]
    out.nz = n[2]
    out.boulder = false
    out.structure = -1
    hit = true
  }
  if (y - h < 8 && t.boulderCount) {
    const G = BOULDER_GRID_N
    const cx = Math.floor((x + HALF) / BOULDER_GRID_CELL)
    const cz = Math.floor((z + HALF) / BOULDER_GRID_CELL)
    for (let dz = -1; dz <= 1; dz++) {
      const zz = cz + dz
      if (zz < 0 || zz >= G) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx
        if (xx < 0 || xx >= G) continue
        const c = zz * G + xx
        for (let s = t.boulderCellStart[c]; s < t.boulderCellStart[c + 1]; s++) {
          const b = t.boulderCellItems[s] * 4
          const ex = x - t.boulders[b]
          const ey = y - t.boulders[b + 1]
          const ez = z - t.boulders[b + 2]
          const r = t.boulders[b + 3]
          const d2 = ex * ex + ey * ey + ez * ez
          if (d2 >= r * r) continue
          const d = Math.sqrt(d2) || 1e-6
          const depth = r - d
          if (!hit || depth > out.depth) {
            out.depth = depth
            out.nx = ex / d
            out.ny = ey / d
            out.nz = ez / d
            out.boulder = true
            out.structure = -1
            hit = true
          }
        }
      }
    }
  }
  // Base structures: few enough to test directly, and only near the base.
  const st = t.structures
  if (st.length && Math.abs(x - t.base.x) < 360 && Math.abs(z - t.base.z) < 360) {
    for (let k = 0; k < st.length; k += 4) {
      const ex = x - st[k]
      const ey = y - st[k + 1]
      const ez = z - st[k + 2]
      const r = st[k + 3]
      const d2 = ex * ex + ey * ey + ez * ez
      if (d2 >= r * r) continue
      const d = Math.sqrt(d2) || 1e-6
      const depth = Math.min(r - d, 1.5)
      if (!hit || depth > out.depth) {
        out.depth = depth
        out.nx = ex / d
        out.ny = ey / d
        out.nz = ez / d
        out.boulder = true
        out.structure = k >> 2
        hit = true
      }
    }
  }
  return hit
}
const scratchN = [0, 1, 0]
