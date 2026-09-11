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
// FUNCTION rather than a constant because the scene can now be looked at under two
// suns that differ by 3.6 stops in how brightly they light the ground.
//
// The history is worth keeping, because for a long time this was thought to be a
// matter of taste. Replacing the terrain's baked hillshade with a real BRDF left the
// ground 4.1 stops darker, since sunlit regolith at 0.12 albedo genuinely is that
// dark, and buying that back looked like a judgement about the photograph rather than
// about the Moon. What settles it is the real sun, which at ~2.08° lights the ground
// at a twelfth of what the 44.46° design sun does — so no single constant can serve
// both, and exposure has to track the sun the way a camera's does.
//
// 3.6 stops and not the 4.3 the cosine suggests, which is worth stating because the
// cosine is the obvious way to work it out and it is wrong. sin(44.46)/sin(2.08) is
// 19.3, but the measured ratio is 12.5: Hapke's shadow-hiding and multiple-scattering
// terms hold a particulate surface's brightness up at grazing incidence, which is the
// same reason the full moon looks like a flat disc rather than a shaded ball. Half a
// stop of over-exposure is visible, so this is derived by CALLING the BRDF rather than
// by scaling a sine — see the tests, and see regolith.ts on the Lambertian shorthand
// having already caused this class of bug three times.
//
// So: expose for the sunlit ground, and fix the constant of proportionality by
// demanding that the DESIGN sun come out at exactly the 1.05 the scene already
// shipped. Nothing about the current frame moves; the mechanism is inert until the
// sun is.
//
// 1.05 itself was solved, for a scene that no longer exists: the old bake put sunlit
// regolith at linear 0.366, and AgX at 1.05 lands that on sRGB 163, spending the
// curve's range at the two ends — four stops of headroom above the regolith before
// anything approaches white, and a toe that still separates -6 stops from black. That
// is the right shape for a world with a 0.5° sun and no atmosphere, where a sunlit
// panel and the shadow beside it are three orders of magnitude apart, so the anchor
// is worth keeping even though what sits at it is now computed.
export const DESIGN_EXPOSURE = 1.05

// Below this the reciprocal runs away. A sun at 0° lights nothing, so exposing for it
// means dividing by zero — and long before that, amplifying a vanishing signal
// amplifies the shadow fill and the fixed-brightness annotation layer with it. 0.25°
// is an eighth of the real sun's own maximum here, which keeps the clamp outside the
// range the scene is looked at while making the function total.
export const MIN_EXPOSURE_ELEV_DEG = 0.25

// One consequence worth knowing before looking at true-sun mode, because it is not
// what you would expect: a SHADOW comes out at the same screen brightness under
// either sun. shadowFillRadiance is linear in the lit ground and this is inversely
// proportional to it, so the product is exactly invariant — and the two are anchored
// together deliberately rather than by luck (there is a test).
//
// So the real sun does not make the scene darker. It changes the GEOMETRY of the
// light: 57% of the patch falls inside a terrain shadow rather than 0%, and shadows
// run for hundreds of metres. That is the whole visible payoff, and it is the reason
// the horizon field was worth building.

// litGroundRadiance is imported directly rather than injected: regolith.ts imports
// nothing at all, by design, so it can be depended on from anywhere without a cycle.
const EXPOSURE_ANCHOR = DESIGN_EXPOSURE * litGroundRadiance(SUN_INTENSITY, SUN_LOCAL_ELEV_DEG)

// Scale factor for anything authored as a fixed SCREEN brightness rather than as a
// physical radiance — the backdrop colour, the starfield, the marker beacons and
// labels. Multiply their linear values by this and they hold still while the exposure
// moves underneath them.
//
// Exposure multiplies linear values on the way to the screen, so holding the product
// constant means dividing by it: at the design sun this is exactly 1.0 and nothing
// changes, and at the real sun's 12.5x it is 0.08.
//
// This is the fix for the whole class, and the class is bigger than it looks. It first
// showed up as a NAVY SKY: the backdrop is #03040a, a near-black that reads as black
// at the shipped exposure and as visible blue at 12.5x. On a world with no atmosphere
// the sky is black, so that was not a small artifact — it was the single most
// unphysical thing in the frame.
export function screenAnchoredScale(elevationDeg: number): number {
  return DESIGN_EXPOSURE / exposureFor(elevationDeg)
}

export function exposureFor(elevationDeg: number): number {
  return (
    EXPOSURE_ANCHOR /
    litGroundRadiance(SUN_INTENSITY, Math.max(MIN_EXPOSURE_ELEV_DEG, elevationDeg))
  )
}
