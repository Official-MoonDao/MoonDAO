/**
 * Lunar Atlas geo helpers (headless, mocha + chai).
 *
 * Covers the lat/lon <-> sphere-position round trip that anchors every marker
 * and 3D model on the globe, plus normalization, great-circle distance, and
 * drill-in framing.
 */

import { expect } from 'chai'
import {
  MOON_RADIUS_M,
  centralAngle,
  clampLat,
  declusterDirections,
  drillInFraming,
  latLonToVector3,
  normalizeLon,
  orbitUpVector,
  surfaceDistanceM,
  surfaceNormal,
  surfaceViewFraming,
  vector3ToLatLon,
} from '../../../lib/lunar-atlas/geo'

function angleBetween(a: [number, number, number], b: [number, number, number]) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.max(-1, Math.min(1, d)))
}

const SAMPLES: { lat: number; lon: number }[] = [
  { lat: 0, lon: 0 },
  { lat: 45, lon: 90 },
  { lat: -85.3, lon: 0 },
  { lat: -89.5, lon: 12 },
  { lat: 23.4, lon: -117.2 },
  { lat: 89.9, lon: 179.9 },
  { lat: -30, lon: -179.9 },
]

describe('lunar-atlas geo', () => {
  describe('lat/lon <-> vector3 round trip', () => {
    for (const s of SAMPLES) {
      it(`round-trips (${s.lat}, ${s.lon}) on the unit sphere`, () => {
        const v = latLonToVector3(s.lat, s.lon, 1)
        // Point lies on the unit sphere.
        const r = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
        expect(Math.abs(r - 1)).to.be.lessThan(1e-9)

        const back = vector3ToLatLon(v)
        expect(Math.abs(back.lat - s.lat)).to.be.lessThan(1e-6)
        expect(Math.abs(normalizeLon(back.lon - s.lon))).to.be.lessThan(1e-6)
      })
    }

    it('round-trips on an arbitrary render radius', () => {
      const v = latLonToVector3(-85.3, 5, 100)
      const r = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
      expect(Math.abs(r - 100)).to.be.lessThan(1e-6)
      const back = vector3ToLatLon(v)
      expect(Math.abs(back.lat - -85.3)).to.be.lessThan(1e-6)
      expect(Math.abs(normalizeLon(back.lon - 5))).to.be.lessThan(1e-6)
    })
  })

  describe('normalization + clamping', () => {
    it('wraps longitude into [-180, 180)', () => {
      expect(normalizeLon(190)).to.equal(-170)
      expect(normalizeLon(-190)).to.equal(170)
      expect(normalizeLon(360)).to.equal(0)
      expect(normalizeLon(180)).to.equal(-180)
    })
    it('clamps latitude to the poles', () => {
      expect(clampLat(120)).to.equal(90)
      expect(clampLat(-120)).to.equal(-90)
      expect(clampLat(12)).to.equal(12)
    })
  })

  describe('great-circle distance', () => {
    it('is zero for identical points', () => {
      expect(surfaceDistanceM({ lat: -85, lon: 0 }, { lat: -85, lon: 0 })).to.equal(0)
    })
    it('equals a quarter circumference from equator to pole', () => {
      const d = surfaceDistanceM({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })
      const quarter = (Math.PI / 2) * MOON_RADIUS_M
      expect(Math.abs(d - quarter)).to.be.lessThan(1)
    })
    it('central angle between antipodes is pi', () => {
      const a = centralAngle({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })
      expect(Math.abs(a - Math.PI)).to.be.lessThan(1e-9)
    })
  })

  describe('declustering', () => {
    it('leaves an isolated point on its true location', () => {
      const map = declusterDirections([{ id: 'a', lat: 0, lon: 0 }])
      const dir = map.get('a')!
      const back = vector3ToLatLon(dir)
      expect(Math.abs(back.lat)).to.be.lessThan(1e-6)
      expect(Math.abs(back.lon)).to.be.lessThan(1e-6)
    })

    it('separates tightly-packed south-pole points so none overlap', () => {
      const pts = [
        { id: 'a', lat: -89.5, lon: 0 },
        { id: 'b', lat: -89.5, lon: 10 },
        { id: 'c', lat: -89.3, lon: -5 },
        { id: 'd', lat: -89.6, lon: 90 },
      ]
      const spread = 0.05
      const map = declusterDirections(pts, spread, 0.11)
      const dirs = pts.map((p) => map.get(p.id)!)
      // Every pair is now separated by a meaningful angle.
      for (let i = 0; i < dirs.length; i++) {
        for (let j = i + 1; j < dirs.length; j++) {
          expect(angleBetween(dirs[i], dirs[j])).to.be.greaterThan(spread * 0.4)
        }
      }
      // Declustered points stay near the original cluster (within a few spreads).
      for (const p of pts) {
        const orig = latLonToVector3(p.lat, p.lon, 1) as [number, number, number]
        expect(angleBetween(map.get(p.id)!, orig)).to.be.lessThan(0.4)
      }
    })

    it('returns a direction for every input id', () => {
      const pts = [
        { id: 'x', lat: 10, lon: 20 },
        { id: 'y', lat: -80, lon: 0 },
        { id: 'z', lat: -80.1, lon: 1 },
      ]
      const map = declusterDirections(pts)
      expect(map.size).to.equal(3)
    })

    it('caps ring growth for large clusters so markers stay near the pole', () => {
      // 12 co-located points (the post-DePrize South Pole census). Uncapped,
      // the ring would fan out spread*(1 + 10*0.12) = 2.2x; the cap holds it
      // to 1.6x so displayed positions don't drift far from the real region.
      const spread = 0.17
      const pts = Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`,
        lat: -89,
        lon: i * 30 - 180,
      }))
      const map = declusterDirections(pts, spread, 0.32)
      const pole = latLonToVector3(-90, 0, 1) as [number, number, number]
      for (const p of pts) {
        const fromPole = angleBetween(map.get(p.id)!, pole)
        expect(fromPole).to.be.lessThan(spread * 1.6 + 0.02)
      }
      // Still pairwise-separated enough to read as distinct markers.
      const dirs = pts.map((p) => map.get(p.id)!)
      for (let i = 0; i < dirs.length; i++) {
        for (let j = i + 1; j < dirs.length; j++) {
          expect(angleBetween(dirs[i], dirs[j])).to.be.greaterThan(0.05)
        }
      }
    })
  })

  describe('drill-in framing', () => {
    it('targets the surface point and pulls the camera out along the normal', () => {
      const { position, target } = drillInFraming(-89.5, 0, 100, 2)
      const targetR = Math.sqrt(target[0] ** 2 + target[1] ** 2 + target[2] ** 2)
      const posR = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2)
      expect(Math.abs(targetR - 100)).to.be.lessThan(1e-6)
      // Camera sits farther out than the surface.
      expect(posR).to.be.greaterThan(targetR)
    })
  })

  describe('orbit up vector (pole-safe camera roll)', () => {
    const len = (v: [number, number, number]) =>
      Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)

    it('keeps the familiar world-Y up for equatorial views', () => {
      const up = orbitUpVector(0, 0)
      expect(angleBetween(up, [0, 1, 0])).to.be.lessThan(1e-6)
    })

    it('is always a unit vector perpendicular to the view normal', () => {
      const sites = [
        { lat: 0, lon: 0 },
        { lat: 45, lon: 90 },
        { lat: -89.5, lon: 0 },
        { lat: -90, lon: 0 },
        { lat: 90, lon: 0 },
        { lat: -85.3, lon: 5 },
      ]
      for (const s of sites) {
        const up = orbitUpVector(s.lat, s.lon)
        const n = surfaceNormal(s.lat, s.lon)
        expect(Math.abs(len(up) - 1), `|up| at (${s.lat},${s.lon})`).to.be.lessThan(1e-9)
        const dot = up[0] * n[0] + up[1] * n[1] + up[2] * n[2]
        expect(Math.abs(dot), `up·n at (${s.lat},${s.lon})`).to.be.lessThan(1e-9)
        for (const c of up) expect(Number.isFinite(c)).to.equal(true)
      }
    })

    it('never degenerates at the poles (where world-Y is parallel to the view axis)', () => {
      const south = orbitUpVector(-90, 0)
      const north = orbitUpVector(90, 0)
      expect(len(south)).to.be.closeTo(1, 1e-9)
      expect(len(north)).to.be.closeTo(1, 1e-9)
    })
  })

  describe('surface view framing (cinematic low-angle camera)', () => {
    const R = 100
    const len = (v: [number, number, number]) =>
      Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
    // Sites covering the equator, mid-latitudes, both tangent-reference
    // branches (|n.y| above/below 0.9), and the exact South Pole.
    const SITES: { lat: number; lon: number }[] = [
      { lat: 0, lon: 0 },
      { lat: 45, lon: 90 },
      { lat: -85.3, lon: 5 },
      { lat: -89.5, lon: 0 },
      { lat: -90, lon: 0 },
    ]

    for (const s of SITES) {
      it(`keeps the eye low and the target on-site at (${s.lat}, ${s.lon})`, () => {
        const { position, target } = surfaceViewFraming(s.lat, s.lon, R)

        // Everything is finite (the pole must not degenerate).
        for (const c of [...position, ...target]) {
          expect(Number.isFinite(c)).to.equal(true)
        }

        // Target hovers targetLift (default 0.028R) above the surface point,
        // along its normal.
        expect(Math.abs(len(target) - R * 1.028)).to.be.lessThan(1e-6)
        const n = surfaceNormal(s.lat, s.lon)
        const tDir = target.map((c) => c / len(target)) as [number, number, number]
        expect(angleBetween(tDir, n)).to.be.lessThan(1e-6)

        // Eye altitude: position = (R + eyeHeight)·n + standoff·t with t ⟂ n,
        // so |position| = sqrt((1.06R)² + (0.18R)²) for the defaults. The
        // camera stays close to the ground — nowhere near a birds-eye orbit.
        const expectedPosR = R * Math.sqrt(1.06 ** 2 + 0.18 ** 2)
        expect(Math.abs(len(position) - expectedPosR)).to.be.lessThan(1e-6)
      })
    }

    it('looks across the surface, not down at it', () => {
      const { position, target } = surfaceViewFraming(-85.3, 5, R)
      const view: [number, number, number] = [
        target[0] - position[0],
        target[1] - position[1],
        target[2] - position[2],
      ]
      const viewLen = len(view)
      const n = surfaceNormal(-85.3, 5)
      // Angle between the view direction and the local horizon plane. A
      // straight-down camera would be ~90°; this framing stays shallow.
      const sinAltitude =
        (view[0] * n[0] + view[1] * n[1] + view[2] * n[2]) / viewLen
      const altitudeDeg = Math.abs(Math.asin(sinAltitude) * (180 / Math.PI))
      expect(altitudeDeg).to.be.lessThan(30)
    })

    it('bearingRad walks the camera around the site without changing the shot geometry', () => {
      const dist = (a: [number, number, number], b: [number, number, number]) =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

      const a = surfaceViewFraming(-89.5, 0, R)
      const b = surfaceViewFraming(-89.5, 0, R, { bearingRad: Math.PI / 2 })
      const c = surfaceViewFraming(-89.5, 0, R, { bearingRad: Math.PI })

      // Same target, same eye altitude, same standoff from the subject…
      expect(dist(a.target, b.target)).to.be.lessThan(1e-9)
      expect(Math.abs(len(a.position) - len(b.position))).to.be.lessThan(1e-9)
      expect(
        Math.abs(dist(a.position, a.target) - dist(b.position, b.target))
      ).to.be.lessThan(1e-9)
      // …but genuinely different vantage points.
      expect(dist(a.position, b.position)).to.be.greaterThan(R * 0.1)
      expect(dist(a.position, c.position)).to.be.greaterThan(R * 0.2)
    })

    it('honors custom eye height, standoff, and target lift', () => {
      const { position, target } = surfaceViewFraming(10, 20, R, {
        eyeHeight: 0.1,
        standoff: 0.3,
        targetLift: 0.05,
      })
      expect(Math.abs(len(target) - R * 1.05)).to.be.lessThan(1e-6)
      const expectedPosR = R * Math.sqrt(1.1 ** 2 + 0.3 ** 2)
      expect(Math.abs(len(position) - expectedPosR)).to.be.lessThan(1e-6)
    })
  })
})
