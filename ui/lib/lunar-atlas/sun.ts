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
