// Sub-resolution regolith detail, as a tiling field of slopes.
//
// The terrain's height field bottoms out at 10 m/px, and the source is smoother
// than that anyway: LOLA's 5 m grids are interpolated from sparse altimeter
// tracks, so there is genuinely no information about the ground between them.
// Stand a camera three metres off the deck and that absence is the whole image —
// smooth plaster where there should be a saturated craterlet field. This module
// generates what is missing.
//
// It stores SLOPES, not shading, and that is the load-bearing difference from
// what it replaced. The old tile baked its own hillshade from its own private
// copy of the sun azimuth, which cannot survive a sun that moves and could not
// be combined with the terrain's relief except by multiplying two images of
// light together. Slopes of superimposed height fields simply add, so the
// renderer sums this into the terrain's own gradient and rebuilds one normal at
// the end (see regolithShader.ts).
//
// No three import: this is a pure array producer so the tile's roughness can be
// measured in a unit test. It is measured, because the amplitude it gets scaled
// by is the one genuinely tuned quantity in the terrain and the first attempt at
// it was more than 2x too shallow.

// Heights are in units of ONE TILE PIXEL. That is not arbitrary: crater depths
// below are fractions of their own radius in pixels, so height-per-pixel is
// dimensionless and the gradient this module returns is already a true slope,
// directly addable to the terrain's.
export type DetailSlopeTile = {
  size: number
  // (gx, gy) pairs, row-major. gy points along map +Y, i.e. up the image.
  data: Float32Array
}

// Lattice sizes for the noise floor, finest first. Amplitude is proportional to
// wavelength so that each octave contributes roughly equal SLOPE — weighting by
// height instead would let the longest wavelength dominate the gradient 16x.
const NOISE_CELLS = [128, 32, 8]
const NOISE_WEIGHT = 0.1

// Crater population, quoted against a reference tile so that the tile describes a
// fixed PHYSICAL roughness rather than a fixed pixel roughness.
//
// This matters and was got wrong twice, so the invariant is worth stating plainly.
// Roughness follows crater COVERAGE, which goes as count * R^2 / size^2. Radii are
// fractions of the tile, so R^2 already carries size^2 and the count must stay
// FIXED. Quoting radii in absolute pixels instead makes coverage grow as the tile
// shrinks; scaling the count by area as well over-corrects by the same factor
// again.
//
// Depth is a fraction of each crater's own radius, so a bowl's slope — and hence
// everything this module returns — is a pure number, independent of both.
const REFERENCE_SIZE = 512
const CRATER_COUNT = 900
const CRATER_MIN_R = 2 / REFERENCE_SIZE
const CRATER_MAX_R = 24 / REFERENCE_SIZE
const CRATER_DEPTH_FRAC: [number, number] = [0.12, 0.42]

// Wrapping value noise: random values on a coarse lattice, smoothstep
// interpolated up to the tile.
//
// Deliberately not white noise, which is what this used to be. White noise puts
// all of its energy at the Nyquist limit, so it has no wavelength: it cannot be
// mip-mapped (every level averages it toward flat), and up close it is
// indistinguishable from sampling error. Measured, it was a third of the tile's
// gradient and contributed nothing but shimmer. Lattice noise has a scale, so it
// survives filtering and reads as ground.
export function valueNoise(size: number, cells: number, rand: () => number): Float32Array {
  const lattice = new Float32Array(cells * cells)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1

  const out = new Float32Array(size * size)
  const scale = cells / size
  const smooth = (t: number) => t * t * (3 - 2 * t)

  for (let y = 0; y < size; y++) {
    const fy = y * scale
    const iy = Math.floor(fy)
    const ty = smooth(fy - iy)
    const y0 = ((iy % cells) + cells) % cells
    const y1 = (y0 + 1) % cells
    for (let x = 0; x < size; x++) {
      const fx = x * scale
      const ix = Math.floor(fx)
      const tx = smooth(fx - ix)
      const x0 = ((ix % cells) + cells) % cells
      const x1 = (x0 + 1) % cells
      const a = lattice[y0 * cells + x0]
      const b = lattice[y0 * cells + x1]
      const c = lattice[y1 * cells + x0]
      const d = lattice[y1 * cells + x1]
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
    }
  }
  return out
}

// The tile's height field, before differencing. Exported for the roughness test.
export function buildDetailHeights(size: number): Float32Array {
  // Deterministic LCG, so the ground does not change between mounts and the
  // measured roughness is a property of the code rather than of a run.
  let s = 12345
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }

  const h = new Float32Array(size * size)
  for (const cells of NOISE_CELLS) {
    const n = valueNoise(size, cells, rand)
    const amp = (size / cells) * NOISE_WEIGHT
    for (let i = 0; i < h.length; i++) h[i] += n[i] * amp
  }

  const [depthLo, depthHi] = CRATER_DEPTH_FRAC
  for (let c = 0; c < CRATER_COUNT; c++) {
    const cx = rand() * size
    const cy = rand() * size
    const R = size * (CRATER_MIN_R + Math.pow(rand(), 2.2) * (CRATER_MAX_R - CRATER_MIN_R))
    const depth = R * (depthLo + rand() * (depthHi - depthLo))
    const pad = Math.ceil(R * 1.4)
    for (let y = Math.floor(cy) - pad; y <= Math.floor(cy) + pad; y++) {
      for (let x = Math.floor(cx) - pad; x <= Math.floor(cx) + pad; x++) {
        const dx = x - cx
        const dy = y - cy
        const r = Math.sqrt(dx * dx + dy * dy) / R
        if (r >= 1.4) continue
        // Parabolic floor inside the rim, a low raised rim outside it.
        const bowl = r < 1 ? -(1 - r * r) : 0.3 * ((1.4 - r) / 0.4)
        const xi = ((x % size) + size) % size
        const yi = ((y % size) + size) % size
        h[yi * size + xi] += bowl * depth
      }
    }
  }
  return h
}

// Central differences with wrap-around, so the tile is seamless in slope as well
// as in height — a tile that only matches in height shows a visible crease under
// grazing light, which is the only light there is here.
export function buildDetailSlopeTile(size = 512): DetailSlopeTile {
  const h = buildDetailHeights(size)
  const data = new Float32Array(size * size * 2)
  for (let y = 0; y < size; y++) {
    const yp = (y + 1) % size
    const ym = (y - 1 + size) % size
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size
      const xm = (x - 1 + size) % size
      const i2 = (y * size + x) * 2
      data[i2] = (h[y * size + xp] - h[y * size + xm]) * 0.5
      // Image rows run top-down while the map frame's +Y runs up.
      data[i2 + 1] = (h[ym * size + x] - h[yp * size + x]) * 0.5
    }
  }
  return { size, data }
}

// RMS slope of the tile as generated, before any octave amplitude is applied.
// The renderer scales by DETAIL_OCTAVES; this is what it scales.
export function detailRmsSlope(tile: DetailSlopeTile): number {
  let acc = 0
  for (let i = 0; i < tile.data.length; i += 2) {
    acc += tile.data[i] * tile.data[i] + tile.data[i + 1] * tile.data[i + 1]
  }
  return Math.sqrt(acc / (tile.size * tile.size))
}
