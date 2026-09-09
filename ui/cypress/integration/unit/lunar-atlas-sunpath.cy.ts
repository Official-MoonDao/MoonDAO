/**
 * Moon Base Zero — the real sun over the ridge (headless, mocha + chai).
 *
 * Everything here is a direction, and a wrong direction is the hardest kind of bug
 * to see in a rendered frame: a sun running backwards round the horizon, or a season
 * inverted, or a bearing quoted in the wrong tangent frame all look completely
 * normal in any single screenshot. They only show up as "the shadows sweep the wrong
 * way", which nobody notices without a reference.
 *
 * So the assertions below are deliberately about things with an outside answer — the
 * elevation range at the site's real latitude, the direction a southern sun
 * circulates, the fact that the sun spends most of the year below the local
 * horizontal — rather than about the code reproducing itself.
 */
import { expect } from 'chai'
import {
  BRIGHTEST_PHASE,
  MOON_OBLIQUITY_DEG,
  SEASON_PERIOD_DAYS,
  SYNODIC_MONTH_DAYS,
  localBearingDeg,
  localElevationDeg,
  maxElevationDeg,
  subsolarLatDeg,
  subsolarLonDeg,
  sunAt,
  trueSunDirection,
} from '../../../lib/lunar-atlas/sunpath'
import {
  DESIGN_EXPOSURE,
  MIN_EXPOSURE_ELEV_DEG,
  SUN_INTENSITY,
  SUN_LOCAL_ELEV_DEG,
  exposureFor,
} from '../../../lib/lunar-atlas/sun'
import { litGroundRadiance, shadowFillRadiance } from '../../../lib/lunar-atlas/regolith'
import { capCenterLatLon, capLocalDirection } from '../../../lib/lunar-atlas/southpole'

const DEG = Math.PI / 180

function envelopeAt(season: number): { lo: number; hi: number } {
  let lo = 90
  let hi = -90
  for (let i = 0; i < 720; i++) {
    const e = sunAt({ lunarDay: i / 720, season }).elevationDeg
    lo = Math.min(lo, e)
    hi = Math.max(hi, e)
  }
  return { lo, hi }
}

describe('lunar sun path: periods and geometry', () => {
  it('uses the synodic month, not the sidereal one', () => {
    // 27.32 days is the sidereal period and the wrong one: what matters here is how
    // long the SUN takes to come back round, which is 29.53. Using the sidereal
    // period would drift the sun a full turn every couple of years.
    expect(SYNODIC_MONTH_DAYS).to.be.closeTo(29.5306, 0.001)
    expect(SEASON_PERIOD_DAYS).to.be.closeTo(365.25, 0.1)
  })

  it('tilts the axis to the ecliptic by 1.54 degrees', () => {
    // The Moon's obliquity is quoted three different ways in the literature — to the
    // ecliptic (1.54°), to its own orbital plane (6.68°), and to the Earth's equator
    // (~23.4° ± 5.1°). Only the first is the one that sets polar illumination, and
    // picking either of the others would multiply the seasonal swing by 4x or 15x.
    expect(MOON_OBLIQUITY_DEG).to.be.closeTo(1.54, 0.01)
  })

  it('puts the subsolar point south at season 0 and north half a year later', () => {
    expect(subsolarLatDeg(0)).to.be.closeTo(-MOON_OBLIQUITY_DEG, 1e-9)
    expect(subsolarLatDeg(0.5)).to.be.closeTo(MOON_OBLIQUITY_DEG, 1e-9)
    expect(subsolarLatDeg(0.25)).to.be.closeTo(0, 1e-9)
  })

  it('never puts the subsolar point outside the obliquity', () => {
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(subsolarLatDeg(i / 200))).to.be.at.most(MOON_OBLIQUITY_DEG + 1e-9)
    }
  })

  it('returns a unit vector at every phase', () => {
    for (let i = 0; i < 40; i++) {
      const d = trueSunDirection({ lunarDay: i / 40, season: i / 37 })
      expect(Math.hypot(d[0], d[1], d[2])).to.be.closeTo(1, 1e-12)
    }
  })
})

describe('lunar sun path: how grazing it really is', () => {
  it('never lifts the sun above ~2.1 degrees at the ridge', () => {
    // The headline fact, and the reason the whole illumination model had to change.
    // Derived from the patch's own centre coordinates rather than quoted, so if the
    // patch ever moves this number follows.
    expect(maxElevationDeg()).to.be.closeTo(2.077, 0.01)
  })

  it('sits an order of magnitude below the sun the base was designed around', () => {
    // Not a redundant assertion: it is the one that says out loud why sun.ts still
    // exists and why baseplan must keep reading it. 44.46° vs 2.08° is a 21x
    // difference in tan(), which is what the solar row spacing is proportional to.
    expect(SUN_LOCAL_ELEV_DEG / maxElevationDeg()).to.be.greaterThan(15)
    expect(Math.tan(SUN_LOCAL_ELEV_DEG * DEG) / Math.tan(maxElevationDeg() * DEG)).to.be.greaterThan(20)
  })

  it('reproduces the elevation envelope for each season', () => {
    // Independently checkable spherical astronomy: at colatitude c with the subsolar
    // point at latitude d, the elevation over one rotation runs from -d - c to
    // -d + c. Asserted against that closed form rather than against recorded output,
    // so this is a real check on the direction construction.
    const colat = 90 + capCenterLatLon().lat
    for (const season of [0, 0.125, 0.25, 0.375, 0.5]) {
      const d = subsolarLatDeg(season)
      const env = envelopeAt(season)
      expect(env.hi, `season ${season} high`).to.be.closeTo(-d + colat, 0.01)
      expect(env.lo, `season ${season} low`).to.be.closeTo(-d - colat, 0.01)
    }
  })

  it('keeps the sun below local horizontal for two fifths of the year', () => {
    // Counter-intuitive and important: the ridge is among the best-lit ground on the
    // Moon, and yet for 39% of the year the sun does not clear its own tangent plane
    // at ANY point in the month, and for 61% it drops below at some point.
    // Illumination through those stretches comes from the ground FALLING AWAY, which
    // is a horizon.ts question, not a dot product. Anything that "fixes" a negative
    // elevation by clamping it has broken precisely that.
    //
    // Both fractions are asserted against the closed form rather than a threshold.
    // The month's high is -d + colat and its low is -d - colat, and d sweeps
    // -obliquity*cos(2*pi*season), so the share of the year with the high below zero
    // is 1 - acos(-colat/obliquity)/pi. Guessing at these instead is how the first
    // version of this test came to assert "most of the year" about 39%.
    const colat = 90 + capCenterLatLon().lat
    const k = colat / MOON_OBLIQUITY_DEG
    const neverAbove = 1 - Math.acos(-k) / Math.PI
    const dipsBelow = 1 - Math.acos(k) / Math.PI

    const samples = 2048
    let fullyBelow = 0
    let partlyBelow = 0
    for (let i = 0; i < samples; i++) {
      const env = envelopeAt(i / samples)
      if (env.hi < 0) fullyBelow++
      if (env.lo < 0) partlyBelow++
    }
    expect(fullyBelow / samples, 'never rises above horizontal').to.be.closeTo(neverAbove, 0.01)
    expect(partlyBelow / samples, 'dips below at some point').to.be.closeTo(dipsBelow, 0.01)
    expect(neverAbove).to.be.closeTo(0.387, 0.005)
    expect(dipsBelow).to.be.closeTo(0.613, 0.005)
  })

  it('is above horizontal all month at southern summer', () => {
    expect(envelopeAt(0).lo).to.be.greaterThan(0)
  })
})

describe('lunar sun path: which way round the sky', () => {
  it('starts at local noon, due geographic north', () => {
    // lunarDay 0 is defined as the subsolar point crossing the ridge's meridian, so
    // the sun must be exactly over the site's longitude and pointing away from the
    // pole — which at 89.46°S is geographic north.
    const site = capCenterLatLon()
    expect(subsolarLonDeg(0)).to.be.closeTo(site.lon, 1e-9)

    // Geographic north in the MAP bearing frame: away from the pole is (sin lon,
    // cos lon) in stereographic X/Y, so its map bearing is atan2(cos, sin).
    const northBearing =
      (Math.atan2(Math.cos(site.lon * DEG), Math.sin(site.lon * DEG)) / DEG + 360) % 360
    expect(sunAt(BRIGHTEST_PHASE).bearingDeg).to.be.closeTo(northBearing, 0.05)
  })

  it('reads bearings in the map frame, which is 137 degrees off geographic', () => {
    // Pinned because it looks like a bug every time. A reader who expects "due north
    // = 90°" will find 227.49° and reach for a fix; this is the test that tells them
    // not to.
    const b = sunAt(BRIGHTEST_PHASE).bearingDeg
    expect(b).to.be.closeTo(227.49, 0.05)
    expect(Math.abs(b - 90)).to.be.greaterThan(100)
  })

  it('circulates counter-clockwise, the way a southern-hemisphere sun does', () => {
    // East, then north, then west. A northern-hemisphere intuition (east, south,
    // west) is the other direction, and flipping the sign in subsolarLonDeg would
    // produce it while looking perfectly plausible in any still frame.
    let prev = sunAt({ lunarDay: 0, season: 0 }).bearingDeg
    let total = 0
    const steps = 360
    for (let i = 1; i <= steps; i++) {
      const b = sunAt({ lunarDay: i / steps, season: 0 }).bearingDeg
      let d = b - prev
      if (d > 180) d -= 360
      if (d < -180) d += 360
      expect(d, `step ${i} must advance, not retreat`).to.be.greaterThan(0)
      total += d
      prev = b
    }
    // Exactly one circuit per lunar day.
    expect(total).to.be.closeTo(360, 0.5)
  })

  it('agrees with the ridge frame the models are placed in', () => {
    // localElevationDeg/localBearingDeg are the inverse of capLocalDirection, and the
    // point of building them from it is that the round trip must close. If it does
    // not, the sun the terrain is lit by and the bearings the hardware is aimed by
    // have quietly diverged.
    for (const [bearing, elev] of [
      [0, 0],
      [90, 30],
      [227.49, 2.08],
      [310, -1.5],
    ] as [number, number][]) {
      const dir = capLocalDirection(bearing, elev)
      expect(localElevationDeg(dir), `elev for ${bearing}/${elev}`).to.be.closeTo(elev, 0.02)
      expect(localBearingDeg(dir), `bearing for ${bearing}/${elev}`).to.be.closeTo(bearing, 0.02)
    }
  })

  it('sweeps the shadow direction through every compass point over one month', () => {
    // The visual payoff, stated as a property: no bearing bucket is skipped, so over
    // a month every slope gets lit and every slope gets shadowed. This is what makes
    // the horizon map worth its 16 azimuths.
    const buckets = new Set<number>()
    for (let i = 0; i < 720; i++) {
      buckets.add(Math.floor(sunAt({ lunarDay: i / 720, season: 0 }).bearingDeg / 22.5))
    }
    expect(buckets.size).to.equal(16)
  })
})

describe('exposing for the sun that is actually up', () => {
  // The reason exposure stopped being a constant. These are the assertions that let
  // the change ship: the first one is the promise that nothing about the current
  // frame moves, and the rest are the reason a constant could not have survived.

  it('reproduces the shipped exposure EXACTLY at the design sun', () => {
    // Not "close to" 1.05. The anchor is defined as the value that makes this
    // identity hold, so any drift means the anchor and the renderer's default have
    // come apart and the scene has silently re-exposed itself.
    expect(exposureFor(SUN_LOCAL_ELEV_DEG)).to.be.closeTo(DESIGN_EXPOSURE, 1e-12)
  })

  it('opens up 3.6 stops for the real sun, which is the whole argument', () => {
    // The number that makes a fixed exposure indefensible rather than merely dark:
    // the real sun on the design exposure is not "a bit dim", it is 12x under.
    const real = maxElevationDeg()
    const ratio = exposureFor(real) / exposureFor(SUN_LOCAL_ELEV_DEG)
    expect(ratio).to.be.closeTo(12.5, 0.3)
    expect(Math.log2(ratio)).to.be.closeTo(3.64, 0.05)
  })

  it('opens up LESS than Lambert would, because the Moon does not limb-darken', () => {
    // Worth its own test because the intuitive answer is wrong in a way that matters.
    // Reasoning from albedo * cos(incidence), the ratio would be sin(44.46)/sin(2.08)
    // = 19.3, i.e. 4.3 stops. The real BRDF gives 12.5, and the gap is physics rather
    // than error: Hapke's shadow-hiding and multiple-scattering terms hold a
    // particulate surface's brightness up at grazing incidence, which is exactly why
    // the full moon reads as a flat disc instead of a shaded ball.
    //
    // regolith.ts already warns that the Lambertian shorthand is 4x wrong at this
    // scene's phase angles and has caused three bugs. This is the same trap in its
    // derivative: using sines to predict how much exposure a lower sun needs
    // overstates it by half a stop, which is a visible over-exposure.
    const real = maxElevationDeg()
    const ratio = exposureFor(real) / exposureFor(SUN_LOCAL_ELEV_DEG)
    const lambert = Math.sin(SUN_LOCAL_ELEV_DEG * DEG) / Math.sin(real * DEG)
    expect(lambert).to.be.closeTo(19.3, 0.3)
    expect(ratio).to.be.lessThan(lambert * 0.8)
    // Not unboundedly flatter, though — it is still mostly the cosine. If this ever
    // drops below about half of Lambert the BRDF has stopped darkening with elevation
    // in a way that would read as a sun that does not set.
    expect(ratio).to.be.greaterThan(lambert * 0.4)
  })

  it('stays finite and monotone across every sun the scene can be shown under', () => {
    // A reciprocal with a clamp is exactly the shape that hides a divide-by-zero
    // until someone scrubs to a sunset. Sweeping the real path, including the ~39% of
    // the year the sun is BELOW local horizontal and elevation goes negative.
    let prev = Infinity
    for (let season = 0; season < 1; season += 0.05) {
      for (let i = 0; i < 60; i++) {
        const e = sunAt({ lunarDay: i / 60, season }).elevationDeg
        const x = exposureFor(e)
        expect(Number.isFinite(x), `finite at elev ${e.toFixed(3)}`).to.equal(true)
        expect(x, `positive at elev ${e.toFixed(3)}`).to.be.greaterThan(0)
      }
    }
    // Monotone non-increasing in elevation: a higher sun always needs less exposure.
    for (let e = -2; e <= 2.2; e += 0.01) {
      const x = exposureFor(e)
      expect(x, `monotone at ${e.toFixed(2)}`).to.be.at.most(prev + 1e-9)
      prev = x
    }
  })

  it('clamps below the horizon instead of running away', () => {
    // Every elevation at or under the floor collapses to one value, and that value is
    // bounded. Without the clamp this is a division by sin(0) the moment the sun sets.
    const floor = exposureFor(MIN_EXPOSURE_ELEV_DEG)
    for (const e of [0, -0.5, -1.9, -90]) {
      expect(exposureFor(e), `elev ${e}`).to.equal(floor)
    }
    // Bounded by something meaningful rather than just finite: under ~160x the design
    // exposure, so the fixed-brightness annotation layer is overexposed at sunset but
    // not by an unbounded amount.
    expect(floor / DESIGN_EXPOSURE).to.be.lessThan(160)
  })

  it('renders a shadow at the same screen brightness under either sun', () => {
    // Falls out of the two derivations agreeing, and worth pinning because it says
    // what true-sun mode will actually look like. shadowFillRadiance is linear in the
    // lit ground and exposure is inversely proportional to it, so the product is
    // exactly invariant: a shadow is the same grey at 2° as at 44°.
    //
    // Which means the difference in true-sun mode is entirely GEOMETRIC — 57% of the
    // patch falls inside a terrain shadow instead of 0%, and shadows run hundreds of
    // metres instead of metres — and not a global darkening. If this test ever fails,
    // one of the two has stopped tracking the sun and the scene will be dimming or
    // blowing out as it is scrubbed.
    const onScreen = (elev: number) =>
      shadowFillRadiance(litGroundRadiance(SUN_INTENSITY, elev)) * exposureFor(elev)
    const design = onScreen(SUN_LOCAL_ELEV_DEG)
    for (const e of [maxElevationDeg(), 1.5, 1, 0.5, MIN_EXPOSURE_ELEV_DEG]) {
      expect(onScreen(e) / design, `elev ${e}`).to.be.closeTo(1, 1e-9)
    }
  })

  it('puts the floor outside the range the scene is looked at', () => {
    // The clamp is only defensible if it never engages while the sun is up. The real
    // sun's maximum is ~2.1°, so the floor must sit well below that.
    expect(MIN_EXPOSURE_ELEV_DEG).to.be.lessThan(maxElevationDeg() / 4)
  })
})
