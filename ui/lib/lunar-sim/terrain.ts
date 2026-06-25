// Deterministic procedural lunar terrain height field.
//
// MVP stand-in for real LOLA DEM data: a seeded value-noise FBM with a few
// crater bowls, in meters. Shared by the terrain mesh (to displace vertices)
// and by the renderer (to ground assets on the surface), so they always agree.
// Swap this for a sampled DEM texture later without touching call sites.

import { hashStringToInt } from './engine/prng'

function fract(n: number): number {
  return n - Math.floor(n)
}

// Deterministic 2D hash in [0, 1).
function hash2(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 0.000123) * 43758.5453
  return fract(s)
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

// Value noise with bilinear smoothing.
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  const top = a + (b - a) * fx
  const bottom = c + (d - c) * fx
  return top + (bottom - top) * fy
}

type Crater = { x: number; y: number; radius: number; depth: number }

function makeCraters(seed: number, radiusM: number): Crater[] {
  const craters: Crater[] = []
  let s = seed >>> 0
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const count = 6
  for (let i = 0; i < count; i++) {
    craters.push({
      x: (rand() * 2 - 1) * radiusM,
      y: (rand() * 2 - 1) * radiusM,
      radius: 80 + rand() * 220,
      depth: 8 + rand() * 24,
    })
  }
  return craters
}

export type TerrainField = {
  seed: number
  radiusM: number
  craters: Crater[]
  // Amplitude of the rolling regolith, in meters.
  amplitude: number
}

export function createTerrainField(seed: string, radiusM: number): TerrainField {
  const seedInt = hashStringToInt(seed)
  return {
    seed: seedInt,
    radiusM,
    craters: makeCraters(seedInt, radiusM),
    amplitude: 30,
  }
}

// Height in meters at local ENU (x east, y north).
export function terrainHeight(
  field: TerrainField,
  x: number,
  y: number
): number {
  // Fractal value noise (a few octaves) for rolling terrain.
  const scale = 0.0015
  let h = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let o = 0; o < 4; o++) {
    h += amp * valueNoise(x * scale * freq, y * scale * freq, field.seed + o * 97)
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  h = (h / norm) * 2 - 1 // -> [-1, 1]
  let height = h * field.amplitude

  // Subtract crater bowls.
  for (const c of field.craters) {
    const dx = x - c.x
    const dy = y - c.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < c.radius) {
      const t = d / c.radius
      // Smooth bowl with a slightly raised rim.
      const bowl = (1 - t * t) * c.depth
      const rim = Math.max(0, 1 - Math.abs(t - 0.9) / 0.1) * c.depth * 0.25
      height -= bowl - rim
    }
  }

  return height
}
