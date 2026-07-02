// Terrain-height sampling for the Lunar Atlas globe.
//
// The globe's relief comes from an equirectangular LOLA DEM applied as a
// displacement map. Anything seated on the globe (markers, models, the
// low-angle surface camera) must agree with that displaced geometry, so this
// module reproduces the exact same height computation on the CPU: sample the
// DEM at a lat/lon and return the displaced radius.
//
// Pure math (no three.js, no DOM) so it is unit-testable headlessly. The
// browser-side piece that decodes the DEM image into a `HeightField` lives in
// `components/lunar-atlas/useTerrainSampler.ts`.

import { clampLat, normalizeLon } from './geo'

// A decoded grayscale equirectangular height map. `data` holds one 0–255
// value per pixel, row-major, row 0 = north (+90 lat), column 0 = -180 lon.
export type HeightField = {
  width: number
  height: number
  data: Uint8ClampedArray | number[]
}

// lat/lon (degrees) -> continuous pixel coordinates on an equirectangular
// image. Matches THREE.SphereGeometry UVs (u: lon -180 -> +180 left to right;
// image top row = north pole), i.e. the same registration the GPU uses when
// displacing the sphere.
export function latLonToEquirectPixel(
  lat: number,
  lon: number,
  width: number,
  height: number
): { x: number; y: number } {
  const u = (normalizeLon(lon) + 180) / 360
  const v = (90 - clampLat(lat)) / 180
  // Pixel centers: u=0 maps to the center of column 0 at x=-0.5+0.5.
  return { x: u * width - 0.5, y: v * height - 0.5 }
}

// Bilinear sample of the height field at a lat/lon, in raw 0–255 units.
// Longitude wraps across the seam; latitude clamps at the poles.
export function sampleHeightField(
  field: HeightField,
  lat: number,
  lon: number
): number {
  const { width, height, data } = field
  const { x, y } = latLonToEquirectPixel(lat, lon, width, height)

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0

  const wrapX = (px: number) => ((px % width) + width) % width
  const clampY = (py: number) => Math.max(0, Math.min(height - 1, py))
  const at = (px: number, py: number) => data[clampY(py) * width + wrapX(px)]

  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx
  return top * (1 - fy) + bottom * fy
}

// The displaced surface radius at a lat/lon — identical formula to
// meshStandardMaterial displacement: radius + texel/255 * scale + bias.
export function displacedRadius(
  field: HeightField,
  lat: number,
  lon: number,
  radius: number,
  scale: number,
  bias: number
): number {
  return radius + (sampleHeightField(field, lat, lon) / 255) * scale + bias
}
