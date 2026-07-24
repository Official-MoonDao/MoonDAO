// Connecting Ridge terrain math for Moon Base Zero.
//
// The scene renders a single 16x16 km patch of the Shackleton-de Gerlache
// connecting ridge (the Artemis-era landing zone), baked at 5 m/px from the
// PGDA "Improved LOLA Elevation Maps for South Pole Landing Sites" Site01
// DEM (Barker et al. 2021). No whole Moon, no polar cap — just the ridge,
// detailed enough to host a true-to-scale moonbase.
//
// This module is the pure-math contract between the baked assets, the
// rendered patch mesh, and everything seated on it (markers, models, the
// surface camera):
//
//   - polar stereographic mapping (lat/lon <-> normalized patch coords),
//     matching the projection of the source DEM — the patch center is OFF
//     the pole, so the mapping carries the baked center offset
//   - 16-bit height decoding (heights are baked into a PNG's R/G channels —
//     8-bit displacement maps band visibly at this zoom level)
//   - patch mesh geometry building (positions computed on the CPU from exact
//     heights, so seated objects and the rendered ground agree by construction)
//   - the mesh-lattice height sampler that reproduces what the mesh renders
//
// The world stays a sphere: positions are still directions scaled by a
// radius, so all of geo.ts (framings, normals) keeps working.
// No three.js imports — unit-testable headlessly.
//
// Constants marked BAKED must match scripts/build-southpole-assets.py output.

import { latLonToVector3, type Vec3 } from './geo'
import { MOON_RADIUS_M } from './geo'
import { GLOBE_RADIUS } from './textures'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// Scene units per real meter. The moonbase is 1:1 — every size in the scene
// (models, layout spacing, camera heights) is a real length times this.
export const M_TO_UNITS = GLOBE_RADIUS / MOON_RADIUS_M

// Vertical scale of terrain heights. 1 = true scale: the models are real
// size, so the ground must be too. BAKED into the albedo hillshade.
export const HEIGHT_EXAGGERATION = 1

// The patch: 16 km square centered on the Connecting Ridge, in south polar
// stereographic X/Y meters (MOON_ME frame; X = rho*sin(lon), Y = rho*cos(lon)).
// All BAKED — printed by the bake script.
export const CAP_EXTENT_M = 16000
export const CAP_CENTER_X_M = -11000
export const CAP_CENTER_Y_M = -12000
export const CAP_HEIGHT_MIN_M = -523.2
export const CAP_HEIGHT_MAX_M = 1959.5
// Ground height at the patch center (the ridge crest) — the moonbase's
// ground level, used to aim the home camera before the height map decodes.
export const CAP_CENTER_HEIGHT_M = 1944.8

// Patch mesh tessellation (grid cells per side): 1024 cells over 16 km is a
// ~15.6 m polygon pitch (~2.1 M triangles — fine for a single unlit mesh).
// The CPU sampler mirrors this lattice, so seated objects agree with the
// rendered ground.
export const CAP_GRID = 1024

// A decoded height field: raw 16-bit values, row-major, row 0 at the top of
// the baked image (t = +0.5, the +Y side of the patch).
export type PolarHeightField = {
  size: number // pixels per side (square)
  minM: number // height (meters) that raw value 0 encodes
  maxM: number // height (meters) that raw value 65535 encodes
  data: Uint16Array
}

// ---------------------------------------------------------------------------
// Projection: polar stereographic (south), matching the PGDA GeoTIFF —
// X = rho*sin(lon) grows right, Y = rho*cos(lon) grows up in the image.
// (s, t) are normalized patch coordinates in [-0.5, 0.5] with the RIDGE
// CENTER (not the pole) at (0, 0): s = +X/map-east, t = +Y/map-north.
// ---------------------------------------------------------------------------

export function latLonToST(lat: number, lon: number): { s: number; t: number } {
  const colat = (90 + Math.max(-90, Math.min(90, lat))) * DEG2RAD
  const rho = 2 * MOON_RADIUS_M * Math.tan(colat / 2)
  const lonRad = lon * DEG2RAD
  return {
    s: (rho * Math.sin(lonRad) - CAP_CENTER_X_M) / CAP_EXTENT_M,
    t: (rho * Math.cos(lonRad) - CAP_CENTER_Y_M) / CAP_EXTENT_M,
  }
}

export function stToLatLon(s: number, t: number): { lat: number; lon: number } {
  const x = s * CAP_EXTENT_M + CAP_CENTER_X_M
  const y = t * CAP_EXTENT_M + CAP_CENTER_Y_M
  const rho = Math.hypot(x, y)
  const colat = 2 * Math.atan(rho / (2 * MOON_RADIUS_M))
  return {
    lat: -90 + colat * RAD2DEG,
    lon: Math.atan2(x, y) * RAD2DEG,
  }
}

// Whether a lat/lon falls inside the patch's square footprint.
export function isInsideCap(lat: number, lon: number): boolean {
  const { s, t } = latLonToST(lat, lon)
  return Math.abs(s) <= 0.5 && Math.abs(t) <= 0.5
}

// The lat/lon of the patch center (the ridge crest, where the base sits).
export function capCenterLatLon(): { lat: number; lon: number } {
  return stToLatLon(0, 0)
}

// Direction (unit vector) of the patch center in scene space.
export function capCenterDirection(): Vec3 {
  const c = capCenterLatLon()
  return latLonToVector3(c.lat, c.lon, 1)
}

// Lat/lon of a point offset from the patch center by map-frame meters
// (+east = image right, +north = image up). This is how the base layout
// places installations: real distances on the real map.
export function capOffsetLatLon(
  eastM: number,
  northM: number
): { lat: number; lon: number } {
  return stToLatLon(eastM / CAP_EXTENT_M, northM / CAP_EXTENT_M)
}

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

function rawToMeters(field: PolarHeightField, raw: number): number {
  return field.minM + (raw / 65535) * (field.maxM - field.minM)
}

// Bilinear height sample (meters) at normalized patch coords. Clamps at the
// edges — the patch square has no seam to wrap.
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

// Terrain height (meters) -> render radius in scene units.
export function heightToRadius(heightM: number): number {
  return GLOBE_RADIUS * (1 + (heightM * HEIGHT_EXAGGERATION) / MOON_RADIUS_M)
}

// The patch's normalized coordinate of a mesh-lattice node.
function nodeST(grid: number, ix: number, iy: number): { s: number; t: number } {
  return { s: ix / grid - 0.5, t: 0.5 - iy / grid }
}

// Height (meters) as the *rendered mesh* shows it: the mesh only has heights
// at its grid-lattice nodes and blends linearly in between, so features
// smaller than the node spacing don't exist in the rendered ground. Sampling
// texels directly would disagree with the visible surface and float/sink
// seated objects.
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

// Rendered terrain radius (scene units) at a lat/lon inside the patch.
export function capRadiusAt(
  field: PolarHeightField,
  grid: number,
  lat: number,
  lon: number
): number {
  const { s, t } = latLonToST(lat, lon)
  return heightToRadius(meshHeightMeters(field, grid, s, t))
}

// ---------------------------------------------------------------------------
// Patch mesh geometry
// ---------------------------------------------------------------------------

export type CapGeometry = {
  positions: Float32Array // (grid+1)^2 xyz triplets
  uvs: Float32Array // (grid+1)^2 uv pairs, matching the baked textures
  indices: Uint32Array
}

// Builds the patch mesh: a regular (grid+1)^2 lattice over the square, each
// node projected onto its spherical direction at the exact decoded height.
export function buildCapGeometry(
  field: PolarHeightField,
  grid: number
): CapGeometry {
  const side = grid + 1
  const positions = new Float32Array(side * side * 3)
  const uvs = new Float32Array(side * side * 2)

  for (let iy = 0; iy < side; iy++) {
    for (let ix = 0; ix < side; ix++) {
      const { s, t } = nodeST(grid, ix, iy)
      const r = heightToRadius(sampleFieldMeters(field, s, t))
      const ll = stToLatLon(s, t)
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
