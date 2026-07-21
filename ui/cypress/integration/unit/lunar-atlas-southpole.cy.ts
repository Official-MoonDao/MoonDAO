/**
 * Lunar Atlas south-pole terrain math (headless, mocha + chai).
 *
 * The scene renders a polar stereographic cap baked from the LOLA
 * LDEM_75S_120M DEM. This pins the projection round trip (lat/lon <-> the
 * normalized square coords the baked textures use), 16-bit height decoding,
 * the mesh-lattice sampler that must agree with the rendered ground, and the
 * cap geometry builder itself.
 */

import { expect } from 'chai'
import { MOON_RADIUS_M, vector3ToLatLon } from '../../../lib/lunar-atlas/geo'
import {
  FAR_EXTENT_M,
  HEIGHT_EXAGGERATION,
  INNER_EXTENT_M,
  buildCapGeometry,
  capRadiusAt,
  heightToRadius,
  isInsideCap,
  latLonToST,
  meshHeightMeters,
  sampleFieldMeters,
  stToLatLon,
  type PolarHeightField,
} from '../../../lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '../../../lib/lunar-atlas/textures'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'

function makeField(
  size: number,
  extentM: number,
  minM: number,
  maxM: number,
  value: (x: number, y: number) => number // raw 0..65535
): PolarHeightField {
  const data = new Uint16Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = value(x, y)
    }
  }
  return { size, extentM, minM, maxM, data }
}

describe('lunar-atlas south pole', () => {
  describe('polar stereographic projection', () => {
    it('maps the pole itself to the square center', () => {
      const { s, t } = latLonToST(-90, 0, INNER_EXTENT_M)
      expect(Math.abs(s)).to.be.lessThan(1e-12)
      expect(Math.abs(t)).to.be.lessThan(1e-12)
    })

    it('puts lon 0 up (+t) and lon 90E right (+s), per the PDS convention', () => {
      const up = latLonToST(-89, 0, INNER_EXTENT_M)
      expect(up.t).to.be.greaterThan(0)
      expect(Math.abs(up.s)).to.be.lessThan(1e-12)
      const right = latLonToST(-89, 90, INNER_EXTENT_M)
      expect(right.s).to.be.greaterThan(0)
      expect(Math.abs(right.t)).to.be.lessThan(1e-12)
    })

    it('round-trips lat/lon through (s, t)', () => {
      const samples = [
        { lat: -90, lon: 0 },
        { lat: -89.9, lon: 0 },
        { lat: -85.3, lon: 5 },
        { lat: -88, lon: -45 },
        { lat: -86, lon: 170 },
        { lat: -89.6, lon: 165 },
      ]
      for (const p of samples) {
        const { s, t } = latLonToST(p.lat, p.lon, INNER_EXTENT_M)
        const back = stToLatLon(s, t, INNER_EXTENT_M)
        expect(Math.abs(back.lat - p.lat), `lat ${p.lat}`).to.be.lessThan(1e-9)
        if (p.lat > -90) {
          const dLon = ((back.lon - p.lon + 540) % 360) - 180
          expect(Math.abs(dLon), `lon ${p.lon}`).to.be.lessThan(1e-9)
        }
      }
    })

    it('is metric at the pole: 120 km north reads as ~120 km of rho', () => {
      // Stereographic scale is true at the pole (distortion < 0.3% at the
      // cap edge), so ground distance ≈ rho near the center.
      const groundM = 120000
      const colatDeg = (groundM / MOON_RADIUS_M) * (180 / Math.PI)
      const { s, t } = latLonToST(-90 + colatDeg, 0, INNER_EXTENT_M)
      const rhoM = Math.hypot(s, t) * INNER_EXTENT_M
      expect(Math.abs(rhoM - groundM) / groundM).to.be.lessThan(0.005)
    })

    it('classifies seed sites inside the inner cap and the far cap edge outside it', () => {
      expect(isInsideCap(-85, 5, INNER_EXTENT_M)).to.equal(true) // Starship HLS
      expect(isInsideCap(-89.5, 0, INNER_EXTENT_M)).to.equal(true) // Base Camp
      expect(isInsideCap(-75, 0, INNER_EXTENT_M)).to.equal(false)
      expect(isInsideCap(-75.5, 0, FAR_EXTENT_M)).to.equal(true)
      expect(isInsideCap(0, 0, FAR_EXTENT_M)).to.equal(false)
    })

    it('covers every located seed project with the inner cap', () => {
      for (const p of SEED_ATLAS.projects) {
        if (!p.location) continue
        expect(
          isInsideCap(p.location.lat, p.location.lon, INNER_EXTENT_M),
          `${p.id} at (${p.location.lat}, ${p.location.lon})`
        ).to.equal(true)
      }
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.location) continue
        expect(
          isInsideCap(g.location.lat, g.location.lon, INNER_EXTENT_M),
          `${g.id}`
        ).to.equal(true)
      }
    })
  })

  describe('height decoding + sampling', () => {
    const MIN = -5000
    const MAX = 7000

    it('decodes raw 0 / 65535 to the min / max heights', () => {
      const lowField = makeField(8, INNER_EXTENT_M, MIN, MAX, () => 0)
      const highField = makeField(8, INNER_EXTENT_M, MIN, MAX, () => 65535)
      expect(sampleFieldMeters(lowField, 0, 0)).to.equal(MIN)
      expect(sampleFieldMeters(highField, 0, 0)).to.equal(MAX)
    })

    it('returns the constant everywhere on a flat field (edges included)', () => {
      const mid = Math.round(((1000 - MIN) / (MAX - MIN)) * 65535)
      const field = makeField(16, INNER_EXTENT_M, MIN, MAX, () => mid)
      for (const [s, t] of [
        [0, 0],
        [0.5, 0.5],
        [-0.5, -0.5],
        [0.49, -0.2],
      ]) {
        expect(Math.abs(sampleFieldMeters(field, s, t) - 1000)).to.be.lessThan(
          0.2
        )
      }
    })

    it('interpolates a horizontal gradient by s', () => {
      const size = 64
      const field = makeField(size, INNER_EXTENT_M, 0, 65535, (x) =>
        Math.round((x / (size - 1)) * 65535)
      )
      const left = sampleFieldMeters(field, -0.4, 0)
      const center = sampleFieldMeters(field, 0, 0)
      const right = sampleFieldMeters(field, 0.4, 0)
      expect(left).to.be.lessThan(center)
      expect(center).to.be.lessThan(right)
    })

    it('maps +t (lon 0 side) to the top image rows', () => {
      // Rows 0..half-1 get one value, the rest another: sampling at +t must
      // read the top value.
      const size = 16
      const field = makeField(size, INNER_EXTENT_M, 0, 65535, (_x, y) =>
        y < size / 2 ? 65535 : 0
      )
      expect(sampleFieldMeters(field, 0, 0.4)).to.be.greaterThan(60000)
      expect(sampleFieldMeters(field, 0, -0.4)).to.be.lessThan(5000)
    })

    it('converts heights to radii with the exaggeration factor', () => {
      const r = heightToRadius(1000)
      const expected =
        GLOBE_RADIUS * (1 + (1000 * HEIGHT_EXAGGERATION) / MOON_RADIUS_M)
      expect(Math.abs(r - expected)).to.be.lessThan(1e-12)
      expect(heightToRadius(0)).to.equal(GLOBE_RADIUS)
      expect(heightToRadius(-1000)).to.be.lessThan(GLOBE_RADIUS)
    })
  })

  describe('mesh-lattice sampling (rendered-surface agreement)', () => {
    // The rendered mesh only has heights at its grid nodes and blends
    // linearly in between; seated objects must reproduce that, not raw
    // texels — otherwise they float over or sink under the visible ground.
    const GRID = 8

    it('equals texel sampling on a flat field', () => {
      const field = makeField(64, INNER_EXTENT_M, -100, 100, () => 30000)
      const direct = sampleFieldMeters(field, 0.13, -0.21)
      const mesh = meshHeightMeters(field, GRID, 0.13, -0.21)
      expect(Math.abs(mesh - direct)).to.be.lessThan(1e-9)
    })

    it('matches texel sampling exactly at grid nodes', () => {
      const field = makeField(64, INNER_EXTENT_M, -100, 100, (x, y) =>
        ((x * 97 + y * 31) * 523) % 65536
      )
      // Node (ix=3, iy=5) of an 8-cell lattice.
      const s = 3 / GRID - 0.5
      const t = 0.5 - 5 / GRID
      const mesh = meshHeightMeters(field, GRID, s, t)
      const direct = sampleFieldMeters(field, s, t)
      expect(Math.abs(mesh - direct)).to.be.lessThan(1e-9)
    })

    it('ignores sub-lattice detail between nodes', () => {
      // A single-texel spike halfway between two lattice nodes: the rendered
      // mesh never sees it.
      const size = 64
      const texPerCell = size / GRID // 8
      const spikeX = Math.round(texPerCell / 2) // between nodes 0 and 1
      const midY = size / 2
      const field = makeField(size, INNER_EXTENT_M, 0, 1000, (x, y) =>
        x === spikeX && y === midY ? 65535 : 0
      )
      const s = (spikeX + 0.5) / size - 0.5
      const t = 0.5 - (midY + 0.5) / size
      expect(sampleFieldMeters(field, s, t)).to.be.greaterThan(500)
      expect(meshHeightMeters(field, GRID, s, t)).to.be.lessThan(1)
    })

    it('capRadiusAt agrees with heightToRadius(meshHeightMeters) at a lat/lon', () => {
      const field = makeField(64, INNER_EXTENT_M, -2000, 5000, (x, y) =>
        ((x * 13 + y * 7) * 331) % 65536
      )
      const lat = -88.2
      const lon = 42
      const { s, t } = latLonToST(lat, lon, INNER_EXTENT_M)
      const viaHeights = heightToRadius(meshHeightMeters(field, GRID, s, t))
      expect(Math.abs(capRadiusAt(field, GRID, lat, lon) - viaHeights)).to.be.lessThan(
        1e-12
      )
    })
  })

  describe('cap geometry builder', () => {
    const field = makeField(32, INNER_EXTENT_M, -3000, 4000, (x, y) =>
      ((x * 41 + y * 17) * 811) % 65536
    )

    it('emits a full (grid+1)^2 lattice with matching UVs and indices', () => {
      const grid = 6
      const { positions, uvs, indices } = buildCapGeometry(field, grid)
      expect(positions.length).to.equal((grid + 1) ** 2 * 3)
      expect(uvs.length).to.equal((grid + 1) ** 2 * 2)
      expect(indices.length).to.equal(grid * grid * 6)
      for (const v of positions) expect(Number.isFinite(v)).to.equal(true)
      // Index buffer stays in range.
      const vertexCount = (grid + 1) ** 2
      for (const i of indices) expect(i).to.be.lessThan(vertexCount)
    })

    it('places every vertex on its spherical direction at the sampled height', () => {
      const grid = 4
      const { positions } = buildCapGeometry(field, grid)
      for (let i = 0; i < positions.length; i += 3) {
        const v: [number, number, number] = [
          positions[i],
          positions[i + 1],
          positions[i + 2],
        ]
        const r = Math.hypot(...v)
        const ll = vector3ToLatLon(v)
        const { s, t } = latLonToST(ll.lat, ll.lon, INNER_EXTENT_M)
        const expected = heightToRadius(sampleFieldMeters(field, s, t))
        expect(Math.abs(r - expected)).to.be.lessThan(1e-6)
        // Deep southern hemisphere, always.
        expect(ll.lat).to.be.lessThan(-80)
      }
    })

    it('depresses the overlap region and returns to true height outside the ramp', () => {
      const grid = 16
      const depress = { innerHalfRatio: 0.2, rampRatio: 0.05, depth: 0.01 }
      const plain = buildCapGeometry(field, grid)
      const sunk = buildCapGeometry(field, grid, depress)
      const side = grid + 1
      for (let iy = 0; iy < side; iy++) {
        for (let ix = 0; ix < side; ix++) {
          const s = ix / grid - 0.5
          const t = 0.5 - iy / grid
          const d = Math.max(Math.abs(s), Math.abs(t))
          const i3 = (iy * side + ix) * 3
          const rPlain = Math.hypot(
            plain.positions[i3],
            plain.positions[i3 + 1],
            plain.positions[i3 + 2]
          )
          const rSunk = Math.hypot(
            sunk.positions[i3],
            sunk.positions[i3 + 1],
            sunk.positions[i3 + 2]
          )
          // Positions are Float32, so compare with a float32-scale epsilon.
          if (d <= depress.innerHalfRatio) {
            // Fully depressed under the inner cap's footprint.
            expect(Math.abs(rPlain - rSunk - depress.depth)).to.be.lessThan(1e-6)
          } else if (d >= depress.innerHalfRatio + depress.rampRatio) {
            expect(Math.abs(rPlain - rSunk)).to.be.lessThan(1e-6)
          } else {
            expect(rSunk).to.be.lessThan(rPlain + 1e-6)
          }
        }
      }
    })
  })
})
