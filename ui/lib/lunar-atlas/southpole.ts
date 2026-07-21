// South-pole terrain math for the Lunar Atlas.
//
// The Atlas no longer renders the whole Moon: every real program in the
// dataset targets the lunar south pole, so the scene is a photorealistic
// polar cap built from the LOLA LDEM_75S_120M DEM (NASA LRO). This module is
// the pure-math contract between the baked assets, the rendered cap meshes,
// and everything seated on them (markers, models, the surface camera):
//
//   - polar stereographic mapping (lat/lon <-> normalized square coords),
//     matching the PDS projection of the source DEM and the baked textures
//   - 16-bit height decoding (heights are baked into a PNG's R/G channels —
//     8-bit displacement maps band visibly at this zoom level)
//   - cap mesh geometry building (positions computed on the CPU from exact
//     heights, so seated objects and the rendered ground agree by construction)
//   - the mesh-lattice height sampler that reproduces what the mesh renders
//
// The world stays a sphere: positions are still directions scaled by a
// radius, so all of geo.ts (framings, declustering, normals) keeps working.
// No three.js imports — unit-testable headlessly.
//
// Constants marked BAKED must match scripts/build-southpole-assets.py output.

import { latLonToVector3, type Vec3 } from './geo'
import { MOON_RADIUS_M } from './geo'
import { GLOBE_RADIUS } from './textures'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// Vertical exaggeration applied to terrain heights. Real polar relief (±7 km
// on a 1737 km sphere) is legible up close but reads flat from the overview;
// 2x keeps craters dramatic without turning Shackleton into a fantasy chasm.
// BAKED into the normal map — keep in sync with the bake script.
export const HEIGHT_EXAGGERATION = 2

// Inner cap: the playable area, ~369 km square centered on the pole
// (covers every seed site — all poleward of -85° — with margin). BAKED.
export const INNER_EXTENT_M = 368640
export const INNER_HEIGHT_MIN_M = -5499
export const INNER_HEIGHT_MAX_M = 7025

// Far surround: full DEM extent (~915 km square, to colat 15° at the edge
// midpoints), rendered coarse behind the inner cap. Its albedo fades to the
// backdrop-sphere tone and its heights feather to the datum before the
// dataset edge, so the cap dissolves into the Moon's limb. BAKED.
export const FAR_EXTENT_M = 914880
export const FAR_HEIGHT_MIN_M = -6829.5
export const FAR_HEIGHT_MAX_M = 7025

// Cap mesh tessellation (grid cells per side). The CPU sampler mirrors these
// lattices, so seated objects agree with the rendered ground.
export const INNER_GRID = 512
export const FAR_GRID = 192

// A decoded polar height field: raw 16-bit values, row-major, row 0 at the
// top of the baked image (t = +0.5, i.e. lon 0 side of the pole).
export type PolarHeightField = {
  size: number // pixels per side (square)
  extentM: number // ground distance covered by the square, meters
  minM: number // height (meters) that raw value 0 encodes
  maxM: number // height (meters) that raw value 65535 encodes
  data: Uint16Array
}

// ---------------------------------------------------------------------------
// Projection: polar stereographic (south), matching the PDS DSMAP_POLAR
// convention the DEM ships in — lon 0 extends "up" in the image, lon 90E to
// the right. (s, t) are normalized square coordinates in [-0.5, 0.5]:
// s = +right (east at lon 90), t = +up (toward lon 0), pole at (0, 0).
// ---------------------------------------------------------------------------

export function latLonToST(
  lat: number,
  lon: number,
  extentM: number
): { s: number; t: number } {
  const colat = (90 + Math.max(-90, Math.min(90, lat))) * DEG2RAD
  const rho = 2 * MOON_RADIUS_M * Math.tan(colat / 2)
  const lonRad = lon * DEG2RAD
  return {
    s: (rho * Math.sin(lonRad)) / extentM,
    t: (rho * Math.cos(lonRad)) / extentM,
  }
}

export function stToLatLon(
  s: number,
  t: number,
  extentM: number
): { lat: number; lon: number } {
  const rho = Math.hypot(s, t) * extentM
  const colat = 2 * Math.atan(rho / (2 * MOON_RADIUS_M))
  return {
    lat: -90 + colat * RAD2DEG,
    lon: Math.atan2(s, t) * RAD2DEG,
  }
}

// Whether a lat/lon falls inside a field's square footprint.
export function isInsideCap(lat: number, lon: number, extentM: number): boolean {
  const { s, t } = latLonToST(lat, lon, extentM)
  return Math.abs(s) <= 0.5 && Math.abs(t) <= 0.5
}

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

function rawToMeters(field: PolarHeightField, raw: number): number {
  return field.minM + (raw / 65535) * (field.maxM - field.minM)
}

// Bilinear height sample (meters) at normalized square coords. Clamps at the
// edges — the polar square has no seam to wrap.
export function sampleFieldMeters(
  field: PolarHeightField,
  s: number,
  t: number
): number {
  const { size, data } = field
  const x = (0.5 + s) * size - 0.5
  const y = (0.5 - t) * size - 0.5
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const cl = (v: number) => Math.max(0, Math.min(size - 1, v))
  const at = (px: number, py: number) => data[cl(py) * size + cl(px)]
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx
  return rawToMeters(field, top * (1 - fy) + bottom * fy)
}

// Terrain height (meters, exaggerated) -> render radius in scene units.
export function heightToRadius(heightM: number): number {
  return GLOBE_RADIUS * (1 + (heightM * HEIGHT_EXAGGERATION) / MOON_RADIUS_M)
}

// The cap's normalized square coordinate of a mesh-lattice node.
function nodeST(grid: number, ix: number, iy: number): { s: number; t: number } {
  return { s: ix / grid - 0.5, t: 0.5 - iy / grid }
}

// Height (meters) as the *rendered mesh* shows it: the mesh only has heights
// at its grid-lattice nodes and blends linearly in between, so features
// smaller than the node spacing don't exist in the rendered ground. Sampling
// texels directly would disagree with the visible surface and float/sink
// seated objects — the same lesson as the old sphere's meshDisplacedRadius.
export function meshHeightMeters(
  field: PolarHeightField,
  grid: number,
  s: number,
  t: number
): number {
  const gx = (s + 0.5) * grid
  const gy = (0.5 - t) * grid
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  const cl = (v: number) => Math.max(0, Math.min(grid, v))
  const at = (ix: number, iy: number) => {
    const n = nodeST(grid, cl(ix), cl(iy))
    return sampleFieldMeters(field, n.s, n.t)
  }
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx
  return top * (1 - fy) + bottom * fy
}

// Rendered terrain radius (scene units) at a lat/lon, per a specific cap
// mesh. Callers pick the field/grid whose mesh covers the point.
export function capRadiusAt(
  field: PolarHeightField,
  grid: number,
  lat: number,
  lon: number
): number {
  const { s, t } = latLonToST(lat, lon, field.extentM)
  return heightToRadius(meshHeightMeters(field, grid, s, t))
}

// ---------------------------------------------------------------------------
// Cap mesh geometry
// ---------------------------------------------------------------------------

export type CapGeometry = {
  positions: Float32Array // (grid+1)^2 xyz triplets
  uvs: Float32Array // (grid+1)^2 uv pairs, matching the baked textures
  indices: Uint32Array
}

// Builds a cap mesh: a regular (grid+1)^2 lattice over the field's square,
// each node projected onto its spherical direction at the exact decoded
// height. `depress` (used by the far surround) sinks the region hidden
// beneath the inner cap so the two meshes never z-fight where they overlap:
// fully depressed inside the inner footprint, ramping back to true height
// over `rampRatio` just OUTSIDE the rim, so the transition dip sits where
// the coarse far mesh is the only visible ground.
export function buildCapGeometry(
  field: PolarHeightField,
  grid: number,
  depress?: { innerHalfRatio: number; rampRatio: number; depth: number }
): CapGeometry {
  const side = grid + 1
  const positions = new Float32Array(side * side * 3)
  const uvs = new Float32Array(side * side * 2)

  for (let iy = 0; iy < side; iy++) {
    for (let ix = 0; ix < side; ix++) {
      const { s, t } = nodeST(grid, ix, iy)
      let r = heightToRadius(sampleFieldMeters(field, s, t))
      if (depress) {
        const d = Math.max(Math.abs(s), Math.abs(t)) // square (Chebyshev) distance
        const k = Math.max(
          0,
          Math.min(
            1,
            (depress.innerHalfRatio + depress.rampRatio - d) / depress.rampRatio
          )
        )
        r -= depress.depth * k
      }
      const ll = stToLatLon(s, t, field.extentM)
      const dir = latLonToVector3(ll.lat, ll.lon, 1)
      const i3 = (iy * side + ix) * 3
      positions[i3] = dir[0] * r
      positions[i3 + 1] = dir[1] * r
      positions[i3 + 2] = dir[2] * r
      const i2 = (iy * side + ix) * 2
      // flipY-style UVs: v = 1 at the image's top row (t = +0.5).
      uvs[i2] = 0.5 + s
      uvs[i2 + 1] = 0.5 + t
    }
  }

  const indices = new Uint32Array(grid * grid * 6)
  let k = 0
  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const a = iy * side + ix
      const b = a + 1
      const c = a + side
      const d = c + 1
      indices[k++] = a
      indices[k++] = c
      indices[k++] = b
      indices[k++] = b
      indices[k++] = c
      indices[k++] = d
    }
  }

  return { positions, uvs, indices }
}

// Direction of the south pole in scene space (all cap geometry is centered
// on it). Kept as a helper so components don't hand-roll [0, -1, 0].
export function southPoleDirection(): Vec3 {
  return latLonToVector3(-90, 0, 1)
}
