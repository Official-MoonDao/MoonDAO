// The real sun over the connecting ridge, as a function of time.
//
// sun.ts holds the sun the base was DESIGNED around: 45° up, fixed, chosen so a
// cartographic hillshade reads clearly. This module holds the sun that is actually
// there. They are separate on purpose and the split is load-bearing, because a
// surprising amount of the base's GEOMETRY is a function of the design sun rather
// than of the lighting: baseplan spaces the solar rows by SOLAR_TOP_H_M / tan(elev)
// so one row does not shade the next, tilts the arrays to face it, and MarkerLayer
// aims the array models along SUN_DIR. Feed a 1.8° sun into those and the row
// spacing goes to 30x, which is not a lighting change, it is a different base.
//
// So: sun.ts stays the authority for anything built, this module is the authority
// for anything lit, and the scene defaults to the former.
//
// WHY IT IS WORTH HAVING. The lunar south pole does not have a day and a night, it
// has a sun that circles the horizon once a month at one to two degrees of
// elevation. Everything visually characteristic about the place follows from that:
// shadows kilometres long, hardware lit edge-on from a bearing that sweeps through
// all 360° over 29.5 days, and crater floors that have not seen the sun in two
// billion years. At the ridge specifically, measured from the patch's own centre
// coordinates (89.46°S, colatitude 0.54°):
//
//   subsolar latitude   elevation over one lunar day
//        -1.54°  (S summer)      +1.00° .. +2.08°
//        -0.77°                  +0.23° .. +1.31°
//         0.00°  (equinox)       -0.54° .. +0.54°
//        +1.54°  (S winter)      -2.08° .. -1.00°
//
// Note what the winter rows mean: the sun sits below the site's LOCAL HORIZONTAL
// for the whole month, and yet the ridge is famously among the best-lit ground on
// the Moon. Both are true because the ground falls away to the north — a skyline
// below horizontal still lets a sun below horizontal through. That is the case the
// signed values in horizon.ts exist for, and it is why illumination here cannot be
// answered with a dot product against a normal.
//
// WHAT IS EXACT AND WHAT IS NOT. The spherical astronomy is exact: given a subsolar
// point, the direction is exact, and the elevation range above falls out of the
// site's real latitude rather than being quoted from a paper. What is NOT tied to
// reality is the absolute calendar phase. Pinning "lunar day 0" to a date needs the
// 18.6-year precession of the Moon's node, and rather than approximate that and
// have it read as precision, time here is expressed as two dimensionless phases the
// UI can scrub directly. Mapping them onto real dates is a separate job.
import { latLonToVector3, type Vec3 } from './geo'
import { capLocalDirection, capCenterLatLon } from './southpole'

// Mean synodic month: the sun's circuit as seen from a point on the Moon, which is
// the rotation period that matters here rather than the sidereal one.
export const SYNODIC_MONTH_DAYS = 29.530589

// Tilt of the Moon's rotation axis to the ecliptic. This is the number that makes
// polar illumination a seasonal question at all — were it zero, the sun would sit
// permanently within half a degree of the horizon and never leave.
export const MOON_OBLIQUITY_DEG = 1.54

// One circuit of the ecliptic by the sun as seen from the Moon.
export const SEASON_PERIOD_DAYS = 365.25

// Time, as two phases in [0, 1).
//
// `lunarDay` is measured from the site's own local noon — the moment the subsolar
// point crosses the ridge's longitude, when the sun is due north and as high as
// that season allows. Anchoring on the site rather than on an ephemeris epoch is
// what lets this module carry no astronomical constants beyond the two periods
// above, and it makes 0 mean something a reader can picture.
//
// `season` is 0 at southern summer solstice, when the subsolar point is at its
// most southerly and the ridge is best lit.
export type SunPhase = {
  lunarDay: number
  season: number
}

// Best-lit sun, and the default for the true-sun mode: local noon at southern
// summer solstice, which is the ~2.08° maximum in the table above.
export const BRIGHTEST_PHASE: SunPhase = { lunarDay: 0, season: 0 }

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// Latitude of the subsolar point: the Moon's obliquity, projected onto the season.
// Negative is southern, so season 0 is the southern summer solstice.
export function subsolarLatDeg(season: number): number {
  return -MOON_OBLIQUITY_DEG * Math.cos(2 * Math.PI * season)
}

// Longitude of the subsolar point.
//
// DECREASING with time, which is the one sign in this file that is easy to get
// backwards and impossible to notice afterwards — a sun running the wrong way round
// the horizon looks entirely normal in any single frame. The Moon rotates prograde,
// so the sun rises in the east and the subsolar point tracks west, and selenographic
// longitude is positive east.
export function subsolarLonDeg(lunarDay: number): number {
  return capCenterLatLon().lon - 360 * lunarDay
}

// The sun as a unit vector from the Moon's centre, in scene world space.
//
// The subsolar point IS the direction to the sun — that is what makes it the
// subsolar point — so this is one call into the same lat/lon conversion the rest of
// the scene uses, rather than a horizontal-coordinates formula with its own azimuth
// convention to get wrong.
export function trueSunDirection(phase: SunPhase): Vec3 {
  const v = latLonToVector3(subsolarLatDeg(phase.season), subsolarLonDeg(phase.lunarDay), 1)
  const len = Math.hypot(v[0], v[1], v[2])
  return [v[0] / len, v[1] / len, v[2] / len]
}

// ---------------------------------------------------------------------------
// The ridge's own view of it
//
// Built out of capLocalDirection rather than a private copy of the tangent basis,
// so there is one construction of the ridge frame in the codebase and this cannot
// drift from the bearings the models are placed by.
// ---------------------------------------------------------------------------

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const RIDGE_UP = capLocalDirection(0, 90)
const RIDGE_EAST = capLocalDirection(0, 0)
const RIDGE_NORTH = capLocalDirection(90, 0)

// Degrees above the ridge's local horizontal. Goes NEGATIVE for most of the year,
// and that is not an error state — see the header. Callers that need to know
// whether the ground is lit have to ask horizon.ts, not this.
export function localElevationDeg(sunDir: Vec3): number {
  return Math.asin(Math.max(-1, Math.min(1, dot3(sunDir, RIDGE_UP)))) * RAD2DEG
}

// Degrees counter-clockwise from local east, the same convention as every district's
// `bearingDeg` and SUN_LOCAL_BEARING_DEG.
//
// "East" here is MAP east — the direction the baked image's +X runs — and not
// geographic east, because that is the frame every bearing in this scene is quoted
// in. The two are 137° apart at this site: the ridge sits at longitude -137.49°, and
// in a polar stereographic projection the direction away from the pole (which at
// 89.46°S is geographic NORTH) points along (sin lon, cos lon), i.e. map bearing
// 227.49°. So the sun at local noon reads as 227.49° here, which is the correct
// answer and looks like a bug. sun.ts documents the last time this frame confusion
// cost somebody an afternoon; this is the same trap one projection further in.
//
// The consequence worth knowing: over a lunar day this INCREASES through a full
// circuit. A southern-hemisphere sun runs east, north, west — counter-clockwise seen
// from above — which is the opposite of the northern-hemisphere intuition, and it is
// asserted in the tests so a sign slip in subsolarLonDeg cannot hide here.
export function localBearingDeg(sunDir: Vec3): number {
  const e = dot3(sunDir, RIDGE_EAST)
  const n = dot3(sunDir, RIDGE_NORTH)
  const deg = Math.atan2(n, e) * RAD2DEG
  return deg < 0 ? deg + 360 : deg
}

// Highest the sun ever gets at the ridge, over the whole year: the answer to "how
// grazing is grazing" without anybody having to trust a number typed in by hand.
export function maxElevationDeg(): number {
  return localElevationDeg(trueSunDirection(BRIGHTEST_PHASE))
}

// Where the sun is at a given phase, packaged the way the renderer wants it.
export function sunAt(phase: SunPhase): {
  dir: Vec3
  elevationDeg: number
  bearingDeg: number
} {
  const dir = trueSunDirection(phase)
  return { dir, elevationDeg: localElevationDeg(dir), bearingDeg: localBearingDeg(dir) }
}
