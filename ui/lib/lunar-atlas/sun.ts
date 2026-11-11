// The one sun over Moon Base Zero.
//
// This used to live in MoonGlobe.tsx, which was fine while the sun was only a
// light. It then became four different things that had to agree exactly — the
// directional light, the hillshade baked into the terrain albedo, the craterlet
// detail tile's own hillshade, and the regolith environment the metal reflects —
// and three of those four had their own private copy of the azimuth. One of the
// copies was already wrong: MoonGlobe's comment claimed bearing 40°, which is
// the MAP-frame azimuth in the bake script, not the bearing a person standing on
// the ridge would measure (50°). Both numbers are below, named for which frame
// each belongs to, so the next person does not have to work out which one a call
// site meant.
//
// Two of those four are now gone. The terrain evaluates the regolith BRDF
// against this direction instead of displaying a hillshade, and the detail tile
// stores slopes instead of shading, so neither holds a sun of its own any more.
// What remains is a light and an environment map, both reading the vector below.
import { latLonToVector3, type Vec3 } from './geo'
import { litGroundRadiance } from './regolith'

// The MAP-frame numbers, in the south-polar frame the DEM is projected into.
//
// These no longer drive a bake — nothing is baked from a sun any more — but they
// are still where SUN_DIR comes from, because the whole point of this module is
// that one direction is written down once. 45° is where a cartographic hillshade
// puts its sun, and the scene inherited it as an artistic choice for legibility;
// the real sun over the connecting ridge never gets more than ~2° above the
// horizon. See docs/MOONBASE_MODEL_HANDOFF.md.
export const SUN_MAP_AZ_DEG = 40
export const SUN_MAP_EL_DEG = 45

// The same direction as a unit vector from the Moon's center, which is what
// the scene actually needs. The map frame's azimuth is the lon argument and
// its elevation the (negated) lat.
export const SUN_DIR: Vec3 = (() => {
  const v = latLonToVector3(-SUN_MAP_EL_DEG, SUN_MAP_AZ_DEG, 1)
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
})()

// What the same sun measures as from the ridge itself: 50° round from east and
// 44.46° up. Not independent facts — both are recovered from SUN_DIR against
// capCenterDirection/capLocalDirection, and were confirmed to 0.02° that way.
// They are written down because the models reason in local bearings (arrays
// stand across the sun's bearing, radiators lie flat) and re-deriving a bearing
// from a world vector at every call site is how the 40°/50° confusion started.
export const SUN_LOCAL_BEARING_DEG = 50
export const SUN_LOCAL_ELEV_DEG = 44.46

// The directional light's own strength and colour. Unitless renderer radiance,
// not lux — everything else in the scene that needs to reason about how bright
// the sun is (the regolith bounce that fills every shadow, above all) is
// expressed as a fraction of this rather than as a second free parameter.
export const SUN_INTENSITY = 3.1
export const SUN_COLOR = '#fff6ec'

// Angular radius of the sun's disc seen from the Moon: 0.2664°, so a 0.533°
// disc. This is the number that decides how soft a shadow is allowed to be,
// and the answer for this scene turns out to be "not at all" — see the shadow
// comments in MoonGlobe.tsx.
export const SUN_ANGULAR_RADIUS_RAD = Math.atan(6.957e8 / 1.496e11)

// ---------------------------------------------------------------------------
// Exposure
//
// Here rather than in the renderer because it is a fact about the sun, and it is a
// FUNCTION rather than a constant because the scene can be looked at under two suns.
//
// THE POLICY, because two wrong ones are already on the record: expose for the
// HIGHLIGHTS — a slope facing the sun — and let flat ground land wherever it lands.
//
// The first wrong answer was tracking FLAT ground: hold level regolith at a constant
// screen brightness under every sun. It sounds neutral and it is not, because at a
// grazing sun flat ground is the DARKEST lit thing in the frame. Radiance at 2°
// incidence varies steeply with local tilt, so a slope leaning 25° into the sun is
// several times brighter than the level ground beside it — normalise on the floor and
// every sun-facing bump in an 8 km bumpy patch goes to white. It renders midnight
// grazing light as chalky noon, which is exactly what it looked like.
//
// (Tracking flat ground with the anchor ALSO re-solved to put it at the bake's 0.366
// was the same mistake squared: 17.6x at the design sun clipped every sunlit hull.
// Both are reverted.)
//
// The second wrong answer is no exposure function at all. At a fixed 1.05 the real
// sun's flat ground lands at sRGB ~7 and the frame dies entirely — the "hole where
// the site should be" bug that started all of this.
//
// Exposing for the highlights is what a photographer does with sidelight, and it is
// the only policy whose failure modes are honest: the brightest terrain in the frame
// sits at the same level under every sun (that is the invariant, and it is tested),
// flat ground falls away below it as the sun drops — dark, which grazing light IS —
// and shadows go to black, which on an airless world they are. The drama of true-sun
// mode comes from the geometry: bright rims, kilometre shadows, 57% of the patch dark.
//
// THE ANCHOR ITSELF is a camera setting, and it is set the way the surface cameras
// were: for the GROUND. Every Apollo surface frame puts sunlit soil in the middle of
// the scale and lets white hardware ride near the top of it, because the soil is most
// of the picture. At 1.05 this scene did the reverse — hardware sat mid-scale and the
// soil it stood on came out at sRGB ~65, a dim brown floor with every shadowed face
// crushed to black, which read as a night level rather than as daylight on the Moon.
//
// 4.2 is two stops up from that. Level soil at the home framing (radiance 0.020)
// lands a stop under mid-grey; a white panel square-on to the sun (0.79) lands 4.2
// stops over it, which is 2.3 stops short of where AgX clips — high on the shoulder,
// with its form still readable; and a shadowed white face, lit only by
// the regolith around it, comes up out of black to a readable dark grey — which is
// what it is in the photographs, where the ground is the fill light.
//
// It is NOT the 17x that put flat ground back at the old bake's 0.366. That frame
// clipped every sunlit hull; this one is anchored to what the ground should read as
// and checked against what the hardware then does.
export const DESIGN_EXPOSURE = 4.2

// The reference highlight: how far a "bright" slope leans into the sun. 25° is a
// common steep-but-stable slope on this patch (repose for regolith is ~30-35°), so at
// any sun elevation e the brightest ordinarily-visible ground is lit at about e + 25°
// of incidence. Raising this darkens true-sun mode overall; it is the one taste knob.
export const HIGHLIGHT_SLOPE_DEG = 25

// Below this the reciprocal runs away: a sun at 0° lights nothing, so exposing for it
// divides by zero. 0.25° is an eighth of the real sun's maximum here, which keeps the
// clamp outside the range the scene is looked at while making the function total.
export const MIN_EXPOSURE_ELEV_DEG = 0.25

// litGroundRadiance is imported directly rather than injected: regolith.ts imports
// nothing at all, by design, so it can be depended on from anywhere without a cycle.
function highlightRadiance(elevationDeg: number): number {
  const e = Math.max(MIN_EXPOSURE_ELEV_DEG, elevationDeg)
  return litGroundRadiance(SUN_INTENSITY, Math.min(90, e + HIGHLIGHT_SLOPE_DEG))
}

// Anchored so the DESIGN sun comes out at exactly DESIGN_EXPOSURE, with an
// exact-equality test on it: the design frame is re-graded on purpose or not at all.
const HIGHLIGHT_ANCHOR = DESIGN_EXPOSURE * highlightRadiance(SUN_LOCAL_ELEV_DEG)

export function exposureFor(elevationDeg: number): number {
  return HIGHLIGHT_ANCHOR / highlightRadiance(elevationDeg)
}

// Scale factor for anything authored as a fixed SCREEN brightness rather than as a
// physical radiance — the backdrop colour and the starfield. Multiply their linear
// values by this and they hold still while the exposure moves underneath them:
// exposure multiplies everything on the way to the screen, so holding the product
// constant means dividing by it. Exactly 1 at the design sun, so the shipped frame
// is untouched.
//
// The class this fixes first showed up as a NAVY SKY: a near-black backdrop colour
// reads as black at one exposure and as visible blue a few stops up, and the one
// thing everybody knows about the lunar sky is that it is black. The backdrop is
// now true black, which no exposure can lift; the starfield still needs this.
export function screenAnchoredScale(elevationDeg: number): number {
  return DESIGN_EXPOSURE / exposureFor(elevationDeg)
}
