/**
 * Lunar Atlas terrain sampling (headless, mocha + chai).
 *
 * The CPU-side DEM sampler must reproduce the GPU displacement exactly:
 * markers, models, and the surface camera all seat against it. These tests
 * pin the equirectangular registration (which lat/lon reads which pixel),
 * bilinear filtering with seam wrap / pole clamp, and the displaced-radius
 * formula (radius + texel/255 * scale + bias).
 */

import { expect } from 'chai'
import {
  displacedRadius,
  latLonToEquirectPixel,
  meshDisplacedRadius,
  sampleHeightField,
  type HeightField,
} from '../../../lib/lunar-atlas/terrain'

function makeField(
  width: number,
  height: number,
  value: (x: number, y: number) => number
): HeightField {
  const data: number[] = new Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = value(x, y)
    }
  }
  return { width, height, data }
}

describe('lunar-atlas terrain', () => {
  describe('equirectangular registration', () => {
    const W = 360
    const H = 180

    it('maps lon 0 to the image center column', () => {
      const { x } = latLonToEquirectPixel(0, 0, W, H)
      expect(Math.abs(x - (W / 2 - 0.5))).to.be.lessThan(1e-9)
    })

    it('maps lat 0 to the image center row', () => {
      const { y } = latLonToEquirectPixel(0, 0, W, H)
      expect(Math.abs(y - (H / 2 - 0.5))).to.be.lessThan(1e-9)
    })

    it('maps north up: +90 at the top edge, -90 at the bottom edge', () => {
      expect(latLonToEquirectPixel(90, 0, W, H).y).to.be.lessThan(0)
      expect(latLonToEquirectPixel(-90, 0, W, H).y).to.be.greaterThan(H - 1)
    })

    it('maps west to the left: -90 lon left of center, +90 right of center', () => {
      const center = W / 2 - 0.5
      expect(latLonToEquirectPixel(0, -90, W, H).x).to.be.lessThan(center)
      expect(latLonToEquirectPixel(0, 90, W, H).x).to.be.greaterThan(center)
    })
  })

  describe('bilinear sampling', () => {
    it('returns the constant for a flat field everywhere (poles + seam included)', () => {
      const field = makeField(64, 32, () => 137)
      for (const [lat, lon] of [
        [0, 0],
        [90, 0],
        [-90, 45],
        [0, 180],
        [0, -180],
        [-89.9, 179.9],
      ]) {
        expect(sampleHeightField(field, lat, lon)).to.equal(137)
      }
    })

    it('interpolates a vertical gradient by latitude', () => {
      // Row value == row index: 0 at north edge, height-1 at south edge.
      const field = makeField(8, 100, (_x, y) => y)
      const north = sampleHeightField(field, 89, 0)
      const equator = sampleHeightField(field, 0, 0)
      const south = sampleHeightField(field, -89, 0)
      expect(north).to.be.lessThan(equator)
      expect(equator).to.be.lessThan(south)
      // Equator sits exactly between the two middle rows.
      expect(Math.abs(equator - 49.5)).to.be.lessThan(1e-9)
    })

    it('wraps across the ±180 seam instead of clamping', () => {
      // Left column = 10, right column = 20, everything else 0 — a sample at
      // the seam must blend both columns, never read out of bounds.
      const W = 36
      const field = makeField(W, 18, (x) =>
        x === 0 ? 10 : x === W - 1 ? 20 : 0
      )
      const atSeam = sampleHeightField(field, 0, -180)
      expect(Math.abs(atSeam - 15)).to.be.lessThan(1e-9)
      // And continuity: just either side of the seam is close to the blend.
      const westOfSeam = sampleHeightField(field, 0, 179.99)
      const eastOfSeam = sampleHeightField(field, 0, -179.99)
      expect(Math.abs(westOfSeam - eastOfSeam)).to.be.lessThan(0.1)
    })

    it('clamps at the poles instead of reading out of bounds', () => {
      const field = makeField(16, 8, (_x, y) => y * 10)
      expect(sampleHeightField(field, 90, 0)).to.equal(0)
      expect(sampleHeightField(field, -90, 0)).to.equal(70)
    })
  })

  describe('displaced radius', () => {
    const R = 2
    const SCALE = 0.06
    const BIAS = -0.03

    it('matches the material formula: radius + texel/255 * scale + bias', () => {
      const low = makeField(4, 4, () => 0)
      const high = makeField(4, 4, () => 255)
      expect(displacedRadius(low, 0, 0, R, SCALE, BIAS)).to.equal(R + BIAS)
      expect(
        Math.abs(displacedRadius(high, 0, 0, R, SCALE, BIAS) - (R + SCALE + BIAS))
      ).to.be.lessThan(1e-12)
    })

    it('puts mid-gray terrain at the mean radius with the centered bias', () => {
      const mid = makeField(4, 4, () => 127.5)
      expect(Math.abs(displacedRadius(mid, 0, 0, R, SCALE, BIAS) - R)).to.be.lessThan(
        1e-12
      )
    })
  })

  describe('mesh-displaced radius (rendered-surface sampling)', () => {
    // The GPU displaces only the sphere's vertex lattice; between vertices
    // the surface is a linear blend of the node heights, regardless of what
    // the DEM texels say there. Seating must reproduce that, not the texels.
    const R = 2
    const SCALE = 0.06
    const BIAS = -0.03
    const SEG = 8 // coarse lattice so texel-vs-mesh divergence is obvious

    it('equals texel sampling on a flat field', () => {
      const field = makeField(64, 32, () => 137)
      for (const [lat, lon] of [
        [0, 0],
        [-85.4, 30],
        [90, 0],
        [-90, 0],
        [12.3, -177.7],
      ]) {
        const mesh = meshDisplacedRadius(field, lat, lon, R, SCALE, BIAS, SEG, SEG)
        const texel = displacedRadius(field, lat, lon, R, SCALE, BIAS)
        expect(Math.abs(mesh - texel)).to.be.lessThan(1e-9)
      }
    })

    it('matches texel sampling exactly at vertex-lattice nodes', () => {
      const field = makeField(64, 32, (x, y) => (x * 7 + y * 13) % 256)
      // Node (ix=2, iy=3) of an 8x8 lattice: lon = 2/8*360-180, lat = 90-3/8*180.
      const lat = 90 - (3 / SEG) * 180
      const lon = (2 / SEG) * 360 - 180
      const mesh = meshDisplacedRadius(field, lat, lon, R, SCALE, BIAS, SEG, SEG)
      const texel = displacedRadius(field, lat, lon, R, SCALE, BIAS)
      expect(Math.abs(mesh - texel)).to.be.lessThan(1e-9)
    })

    it('ignores sub-lattice DEM detail between nodes (blends node heights instead)', () => {
      // A single-texel spike halfway between two lattice nodes: the rendered
      // mesh never sees it, so the mesh height must stay at the background
      // level while raw texel sampling reads the spike.
      const W = 64
      const H = 32
      // Lattice nodes (SEG=8) sit every 8 texels; put the spike at x=4 (between
      // nodes 0 and 1), on the equator row.
      const eqRow = Math.round((0.5 * H) - 0.5)
      const field = makeField(W, H, (x, y) => (x === 4 && y === eqRow ? 255 : 0))
      const spikeLon = ((4 + 0.5) / W) * 360 - 180
      const spikeLat = 90 - ((eqRow + 0.5) / H) * 180

      const texel = displacedRadius(field, spikeLat, spikeLon, R, SCALE, BIAS)
      const mesh = meshDisplacedRadius(
        field,
        spikeLat,
        spikeLon,
        R,
        SCALE,
        BIAS,
        SEG,
        SEG
      )
      expect(texel).to.be.greaterThan(R) // raw texels see the spike
      expect(mesh).to.be.lessThan(R) // the rendered lattice does not
    })

    it('is continuous across the ±180 seam', () => {
      const field = makeField(64, 32, (x, y) => (x * 3 + y * 5) % 256)
      const west = meshDisplacedRadius(field, -40, 179.99, R, SCALE, BIAS, SEG, SEG)
      const east = meshDisplacedRadius(field, -40, -179.99, R, SCALE, BIAS, SEG, SEG)
      expect(Math.abs(west - east)).to.be.lessThan(SCALE * 0.01)
    })
  })
})
