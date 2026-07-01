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
  surfaceDistanceM,
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
})
