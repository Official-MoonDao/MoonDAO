/**
 * Moon Base Zero — Connecting Ridge terrain math (headless, mocha + chai).
 *
 * The scene renders a single 16x16 km polar stereographic patch centered on
 * the Shackleton-de Gerlache connecting ridge (PGDA Site01 LOLA DEM). This
 * pins the projection round trip (lat/lon <-> the normalized patch coords
 * the baked textures use) including the off-pole center offset, 16-bit
 * height decoding, the mesh-lattice sampler that must agree with the
 * rendered ground, and the patch geometry builder itself.
 */

import { expect } from 'chai'
import {
  MOON_RADIUS_M,
  surfaceDistanceM,
  vector3ToLatLon,
} from '../../../lib/lunar-atlas/geo'
import {
  CAP_CENTER_X_M,
  CAP_CENTER_Y_M,
  CAP_EXTENT_M,
  HEIGHT_EXAGGERATION,
  buildCapGeometry,
  capCenterLatLon,
  capOffsetLatLon,
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

function makeField(
  size: number,
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
  return { size, minM, maxM, data }
}

describe('moonbase connecting-ridge terrain', () => {
  describe('polar stereographic projection (off-pole patch center)', () => {
    it('maps the patch center to (0, 0) and back', () => {
      const c = capCenterLatLon()
      const { s, t } = latLonToST(c.lat, c.lon)
      expect(Math.abs(s)).to.be.lessThan(1e-9)
      expect(Math.abs(t)).to.be.lessThan(1e-9)
    })

    it('centers on the Connecting Ridge, not the pole', () => {
      const c = capCenterLatLon()
      // ~89.46 S, ~137.5 W — the Shackleton-de Gerlache connecting ridge.
      expect(c.lat).to.be.greaterThan(-89.6).and.lessThan(-89.3)
      expect(c.lon).to.be.greaterThan(-140).and.lessThan(-135)
      // The pole itself (~16.3 km away) falls outside the 16 km patch.
      const pole = latLonToST(-90, 0)
      expect(Math.hypot(pole.s, pole.t)).to.be.greaterThan(0.5)
    })

    it('round-trips lat/lon through (s, t) across the patch', () => {
      const c = capCenterLatLon()
      const samples = [
        { lat: c.lat, lon: c.lon },
        capOffsetLatLon(7000, 7000),
        capOffsetLatLon(-7000, 3000),
        capOffsetLatLon(100, -7500),
        capOffsetLatLon(-25, 40),
      ]
      for (const p of samples) {
        const { s, t } = latLonToST(p.lat, p.lon)
        const back = stToLatLon(s, t)
        expect(Math.abs(back.lat - p.lat), `lat ${p.lat}`).to.be.lessThan(1e-9)
        const dLon = ((back.lon - p.lon + 540) % 360) - 180
        expect(Math.abs(dLon), `lon ${p.lon}`).to.be.lessThan(1e-9)
      }
    })

    it('keeps map-frame offsets metric: 1 km east reads as ~1 km on the ground', () => {
      // Stereographic scale is true at the pole and distorts <0.01% at the
      // ridge (16 km out), so map meters are ground meters here.
      const c = capCenterLatLon()
      const p = capOffsetLatLon(1000, 0)
      const d = surfaceDistanceM(c, p)
      expect(Math.abs(d - 1000) / 1000).to.be.lessThan(0.005)
      // And the offset lands at the expected normalized coordinate.
      const { s, t } = latLonToST(p.lat, p.lon)
      expect(Math.abs(s - 1000 / CAP_EXTENT_M)).to.be.lessThan(1e-9)
      expect(Math.abs(t)).to.be.lessThan(1e-9)
    })

    it('matches the baked GeoTIFF registration', () => {
      // The bake script derives the center from the tiepoint; both sides
      // must agree or textures shift off the geometry.
      expect(CAP_CENTER_X_M).to.equal(-11000)
      expect(CAP_CENTER_Y_M).to.equal(-12000)
      expect(CAP_EXTENT_M).to.equal(16000)
    })

    it('classifies points in and out of the patch', () => {
      expect(isInsideCap(capCenterLatLon().lat, capCenterLatLon().lon)).to.equal(
        true
      )
      const nearEdge = capOffsetLatLon(7900, 7900)
      expect(isInsideCap(nearEdge.lat, nearEdge.lon)).to.equal(true)
      const outside = capOffsetLatLon(8200, 0)
      expect(isInsideCap(outside.lat, outside.lon)).to.equal(false)
      expect(isInsideCap(-85, 5)).to.equal(false) // way off-patch
      expect(isInsideCap(0, 0)).to.equal(false)
    })

    it('keeps the whole base layout inside the patch', () => {
      // The zoned settlement spans a few hundred meters around the center —
      // it must sit comfortably inside the 16 km square.
      for (const [e, n] of [
        [0, 0],
        [-40, 105],
        [45, 30],
        [-15, 20],
        [-45, 12],
        [-55, -25],
        [70, 0],
      ]) {
        const ll = capOffsetLatLon(e, n)
        expect(isInsideCap(ll.lat, ll.lon), `offset ${e},${n}`).to.equal(true)
      }
    })
  })

  describe('height decoding + sampling', () => {
    const MIN = -500
    const MAX = 2000

    it('decodes raw 0 / 65535 to the min / max heights', () => {
      const lowField = makeField(8, MIN, MAX, () => 0)
      const highField = makeField(8, MIN, MAX, () => 65535)
      expect(sampleFieldMeters(lowField, 0, 0)).to.equal(MIN)
      expect(sampleFieldMeters(highField, 0, 0)).to.equal(MAX)
    })

    it('returns the constant everywhere on a flat field (edges included)', () => {
      const mid = Math.round(((1000 - MIN) / (MAX - MIN)) * 65535)
      const field = makeField(16, MIN, MAX, () => mid)
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
      const field = makeField(size, 0, 65535, (x) =>
        Math.round((x / (size - 1)) * 65535)
      )
      const left = sampleFieldMeters(field, -0.4, 0)
      const center = sampleFieldMeters(field, 0, 0)
      const right = sampleFieldMeters(field, 0.4, 0)
      expect(left).to.be.lessThan(center)
      expect(center).to.be.lessThan(right)
    })

    it('maps +t (map north) to the top image rows', () => {
      // Rows 0..half-1 get one value, the rest another: sampling at +t must
      // read the top value.
      const size = 16
      const field = makeField(size, 0, 65535, (_x, y) =>
        y < size / 2 ? 65535 : 0
      )
      expect(sampleFieldMeters(field, 0, 0.4)).to.be.greaterThan(60000)
      expect(sampleFieldMeters(field, 0, -0.4)).to.be.lessThan(5000)
    })

    it('converts heights to radii at true scale (exaggeration = 1)', () => {
      expect(HEIGHT_EXAGGERATION).to.equal(1)
      const r = heightToRadius(1000)
      const expected = GLOBE_RADIUS * (1 + 1000 / MOON_RADIUS_M)
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
      const field = makeField(64, -100, 100, () => 30000)
      const direct = sampleFieldMeters(field, 0.13, -0.21)
      const mesh = meshHeightMeters(field, GRID, 0.13, -0.21)
      expect(Math.abs(mesh - direct)).to.be.lessThan(1e-9)
    })

    it('matches texel sampling exactly at grid nodes', () => {
      const field = makeField(64, -100, 100, (x, y) =>
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
      const field = makeField(size, 0, 1000, (x, y) =>
        x === spikeX && y === midY ? 65535 : 0
      )
      const s = (spikeX + 0.5) / size - 0.5
      const t = 0.5 - (midY + 0.5) / size
      expect(sampleFieldMeters(field, s, t)).to.be.greaterThan(500)
      expect(meshHeightMeters(field, GRID, s, t)).to.be.lessThan(1)
    })

    // buildCapGeometry splits each cell along the b-c anti-diagonal, so the
    // rendered ground is two FLAT triangles per cell. Bilinear interpolation
    // (the intuitive thing to write) is a curved saddle that touches those
    // triangles only at the nodes, so it floated or sank objects by the saddle
    // term — several centimeters on real ridge terrain.
    it('interpolates on the rendered triangle, not bilinearly', () => {
      // Pure saddle over one cell: corners 0, 1, 1, 0 make the two terms
      // maximally disagree at the cell center.
      const grid = 2
      const size = grid + 1
      const field = makeField(size, 0, 100, (x, y) =>
        (x + y) % 2 === 0 ? 0 : 65535
      )
      const nodeH = (ix: number, iy: number) =>
        meshHeightMeters(field, grid, ix / grid - 0.5, 0.5 - iy / grid)
      const a = nodeH(0, 0)
      const b = nodeH(1, 0)
      const c = nodeH(0, 1)
      const d = nodeH(1, 1)
      // Center of cell (0,0): fx = fy = 0.5, exactly on the b-c diagonal, so
      // both triangles give the diagonal's midpoint (b + c) / 2.
      const center = meshHeightMeters(field, grid, 0.25 - 0.5, 0.5 - 0.25)
      expect(Math.abs(center - (b + c) / 2)).to.be.lessThan(1e-9)
      // Bilinear would instead average all four corners.
      const bilinear = (a + b + c + d) / 4
      expect(Math.abs(center - bilinear)).to.be.greaterThan(10)

      // A point inside the lower-left triangle (a, c, b) lies on ITS plane.
      const fx = 0.2
      const fy = 0.3
      const got = meshHeightMeters(
        field,
        grid,
        (0 + fx) / grid - 0.5,
        0.5 - (0 + fy) / grid
      )
      expect(Math.abs(got - (a + (b - a) * fx + (c - a) * fy))).to.be.lessThan(1e-9)
    })

    it('capRadiusAt agrees with heightToRadius(meshHeightMeters) at a lat/lon', () => {
      const field = makeField(64, -500, 2000, (x, y) =>
        ((x * 13 + y * 7) * 331) % 65536
      )
      const ll = capOffsetLatLon(2500, -3100)
      const { s, t } = latLonToST(ll.lat, ll.lon)
      const viaHeights = heightToRadius(meshHeightMeters(field, GRID, s, t))
      expect(
        Math.abs(capRadiusAt(field, GRID, ll.lat, ll.lon) - viaHeights)
      ).to.be.lessThan(1e-12)
    })
  })

  describe('patch geometry builder', () => {
    const field = makeField(32, -500, 2000, (x, y) =>
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
      const { positions, origin } = buildCapGeometry(field, grid)
      for (let i = 0; i < positions.length; i += 3) {
        // Positions are relative to `origin` (the mesh transform carries it).
        const v: [number, number, number] = [
          positions[i] + origin[0],
          positions[i + 1] + origin[1],
          positions[i + 2] + origin[2],
        ]
        const r = Math.hypot(...v)
        const ll = vector3ToLatLon(v)
        const { s, t } = latLonToST(ll.lat, ll.lon)
        const expected = heightToRadius(sampleFieldMeters(field, s, t))
        expect(Math.abs(r - expected)).to.be.lessThan(1e-6)
        // Deep southern hemisphere, always.
        expect(ll.lat).to.be.lessThan(-89)
      }
    })

    // Vertices MUST stay near zero. A scene unit is ~869 km, so a float32
    // attribute holding absolute (magnitude ~2) positions can only resolve
    // ~21 cm — enough to float seated models, and enough for the vertex
    // shader's modelViewMatrix product to re-round differently every time the
    // camera moves, which makes the whole landscape jitter.
    it('keeps vertices near the origin so float32 resolves millimeters', () => {
      const { positions, origin } = buildCapGeometry(field, 8)
      expect(Math.hypot(...origin)).to.be.greaterThan(GLOBE_RADIUS * 0.9)
      let maxComponent = 0
      for (const v of positions) maxComponent = Math.max(maxComponent, Math.abs(v))
      // Half the patch (8 km) is ~0.0092 units; allow slack for relief.
      expect(maxComponent).to.be.lessThan(0.02)
      // Float32 spacing at that magnitude, in meters.
      const exp = Math.floor(Math.log2(maxComponent))
      const stepM =
        Math.pow(2, exp - 23) * (MOON_RADIUS_M / GLOBE_RADIUS)
      expect(stepM).to.be.lessThan(0.005)
    })
  })
})
