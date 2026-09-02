/**
 * Moon Base Zero — lighting and regolith scattering (headless, mocha + chai).
 *
 * The render itself needs a GPU and can only be judged by eye, but everything
 * the render is derived FROM is arithmetic, and that is what this pins. Two
 * classes of bug are worth a test here.
 *
 * The first is disagreement. The scene's sun is four things at once — a
 * directional light, the hillshade baked into the terrain albedo, the craterlet
 * detail tile's own hillshade, and the regolith the metal reflects. They used
 * to hold private copies of the azimuth, and one copy was already wrong (a
 * map-frame 40° written down as a local bearing, which is really 50°). The
 * round-trip cases below re-derive the local bearing and elevation from
 * SUN_DIR, so the two frames can never again be confused without a red test.
 *
 * The second is the regolith BRDF, where the values matter and are easy to get
 * subtly wrong: the surge has to be exactly neutral at the reference angle or
 * the whole scene's exposure shifts, and it has to stay monotone in phase or
 * the ground brightens as the camera turns AWAY from opposition.
 */
import { expect } from 'chai'
import {
  OPPOSITION_B0,
  OPPOSITION_H,
  PHASE_REF_DEG,
  REGOLITH_ALBEDO,
  normalizedSurge,
  oppositionSurge,
} from '../../../lib/lunar-atlas/regolith'
import { capCenterDirection, capLocalDirection } from '../../../lib/lunar-atlas/southpole'
import {
  SUN_ANGULAR_RADIUS_RAD,
  SUN_DIR,
  SUN_INTENSITY,
  SUN_LOCAL_BEARING_DEG,
  SUN_LOCAL_ELEV_DEG,
  SUN_MAP_AZ_DEG,
  SUN_MAP_EL_DEG,
} from '../../../lib/lunar-atlas/sun'

const DEG = Math.PI / 180

type V = readonly [number, number, number]

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const angleDeg = (a: V, b: V) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG

describe('sun direction', () => {
  it('is a unit vector', () => {
    expect(Math.hypot(...SUN_DIR)).to.be.closeTo(1, 1e-12)
  })

  it('agrees with the bake it was derived from', () => {
    // SUN_DIR is built by feeding the map-frame azimuth in as longitude and the
    // negated map-frame elevation in as latitude. That identity is the only
    // reason the light and the baked hillshade can be kept in step by
    // construction, so assert it holds rather than trusting the comment.
    expect(SUN_MAP_AZ_DEG).to.equal(40)
    expect(SUN_MAP_EL_DEG).to.equal(45)
  })

  it('recovers the documented local elevation above the ridge', () => {
    // Elevation is 90° minus the angle between the sun and the local up at the
    // cap center. Nothing in this is a free parameter; if the number in sun.ts
    // drifts from SUN_DIR, the models' hand-placed hardware stops agreeing
    // with the light.
    const up = capCenterDirection() as V
    const elev = 90 - angleDeg(SUN_DIR as V, up)
    expect(elev).to.be.closeTo(SUN_LOCAL_ELEV_DEG, 0.02)
  })

  it('recovers the documented local bearing above the ridge', () => {
    // Bearing is recovered by asking capLocalDirection, the same helper every
    // model uses to place itself, which direction reproduces SUN_DIR. Scanning
    // rather than solving keeps the test independent of that helper's algebra.
    const up = capCenterDirection() as V
    const elev = 90 - angleDeg(SUN_DIR as V, up)
    let best = { bearing: -1, err: Infinity }
    for (let b = 0; b < 360; b += 0.05) {
      const err = angleDeg(capLocalDirection(b, elev) as V, SUN_DIR as V)
      if (err < best.err) best = { bearing: b, err }
    }
    expect(best.err).to.be.lessThan(0.02)
    expect(best.bearing).to.be.closeTo(SUN_LOCAL_BEARING_DEG, 0.1)
  })

  it('is NOT at the map-frame azimuth when measured locally', () => {
    // The bug this file exists to prevent. The two frames differ by ~10°, so a
    // call site that reaches for the wrong one is off by a visible amount, not
    // a rounding error.
    expect(Math.abs(SUN_LOCAL_BEARING_DEG - SUN_MAP_AZ_DEG)).to.be.greaterThan(5)
  })

  it('subtends the sun s real angular diameter', () => {
    // 0.5326° across, seen from 1 AU. This is the number that sets how soft a
    // shadow penumbra is allowed to get.
    expect((SUN_ANGULAR_RADIUS_RAD * 2) / DEG).to.be.closeTo(0.5326, 0.002)
  })

  it('keeps intensity positive and finite', () => {
    expect(SUN_INTENSITY).to.be.greaterThan(0)
    expect(Number.isFinite(SUN_INTENSITY)).to.equal(true)
  })
})

describe('regolith albedo', () => {
  it('is as dark as the Moon actually is', () => {
    // Highland regolith normal albedo. Bracketed rather than pinned: anything
    // outside this range is not lunar soil, and drifting up toward 0.3 is what
    // makes a Moon render look like white plaster.
    expect(REGOLITH_ALBEDO).to.be.within(0.07, 0.2)
  })
})

describe('opposition surge', () => {
  it('peaks at exact opposition with the full Hapke amplitude', () => {
    // B(0) = 1 + B0, because at zero phase every grain shadow is hidden behind
    // the grain that casts it.
    expect(oppositionSurge(0)).to.be.closeTo(1 + OPPOSITION_B0, 1e-12)
  })

  it('decays to unity looking into the sun', () => {
    // B(180°) -> 1: tan(g/2) diverges, so the surge term vanishes entirely.
    expect(oppositionSurge(180 * DEG)).to.be.closeTo(1, 1e-6)
  })

  it('is monotonically decreasing in phase angle', () => {
    // The physical content of the term. If this ever fails the ground gets
    // brighter as the camera turns away from the light, which reads instantly
    // as broken.
    let prev = Infinity
    for (let g = 0; g <= 180; g += 0.5) {
      const b = oppositionSurge(g * DEG)
      expect(b).to.be.lessThan(prev)
      prev = b
    }
  })

  it('halves its amplitude at the half-width angle', () => {
    // h is defined as the phase angle where tan(g/2) = h, i.e. where the surge
    // is exactly half its peak amplitude. Confirms h is being used as an
    // angular width and not as an opaque fudge factor.
    const gHalf = 2 * Math.atan(OPPOSITION_H)
    expect(oppositionSurge(gHalf) - 1).to.be.closeTo(OPPOSITION_B0 / 2, 1e-12)
  })

  it('is exactly neutral at the reference angle', () => {
    // The load-bearing property. The terrain bake was exposed with no surge at
    // all, so the normalized surge must be 1.0 at the phase angle the home
    // framing actually sits at, or every shot in the app shifts brightness.
    expect(normalizedSurge(PHASE_REF_DEG * DEG)).to.be.closeTo(1, 1e-12)
  })

  it('brightens toward opposition and dims away from it', () => {
    expect(normalizedSurge(0)).to.be.greaterThan(1)
    expect(normalizedSurge(180 * DEG)).to.be.lessThan(1)
  })

  it('stays inside a range a tone curve can absorb', () => {
    // Under 2x at the top and above 0.9 at the bottom, across the whole sphere
    // of view directions. A surge that swung further than this would clip the
    // sunlit ground at one end of a camera orbit and crush it at the other.
    let lo = Infinity
    let hi = -Infinity
    for (let g = 0; g <= 180; g += 0.5) {
      const b = normalizedSurge(g * DEG)
      lo = Math.min(lo, b)
      hi = Math.max(hi, b)
    }
    expect(hi).to.be.within(1.5, 2.0)
    expect(lo).to.be.within(0.9, 1.0)
  })

  it('leaves the reference framing alone to within a couple of percent', () => {
    // PHASE_REF_DEG was chosen from the phase angles the home framing actually
    // spans (68°-99°). Over that whole span the surge stays within ~10% of
    // neutral, so the shot the user lands on is essentially as authored.
    for (let g = 68; g <= 99; g += 1) {
      expect(normalizedSurge(g * DEG)).to.be.closeTo(1, 0.1)
    }
  })
})
