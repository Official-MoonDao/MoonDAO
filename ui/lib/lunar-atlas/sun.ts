// The one sun over Moon Base Zero.
//
// This used to live in MoonGlobe.tsx, which was fine while the sun was only a
// light. It is now four different things that have to agree exactly — the
// directional light, the hillshade already baked into the terrain albedo, the
// craterlet detail tile's own hillshade, and the regolith environment the
// metal reflects — and three of those four had their own private copy of the
// azimuth. One of the copies was already wrong: MoonGlobe's comment claimed
// bearing 40°, which is the MAP-frame azimuth in the bake script, not the
// bearing a person standing on the ridge would measure (50°). Both numbers are
// below, named for which frame each belongs to, so the next person does not
// have to work out which one a call site meant.
import { latLonToVector3, type Vec3 } from './geo'

// The bake's own numbers (SUN_AZ_DEG / SUN_EL_DEG in build-southpole-assets.py),
// in the south-polar MAP frame the DEM is projected into. Changing either means
// re-running the bake — the terrain albedo IS a hillshade from this direction,
// so a light that disagrees with it reads instantly as fake.
export const SUN_MAP_AZ_DEG = 40
export const SUN_MAP_EL_DEG = 45

// The same direction as a unit vector from the Moon's center, which is what
// the scene actually needs. The map frame's azimuth is the lon argument and
// its elevation the (negated) lat — that identity is the whole reason the bake
// and the light can be kept in step by construction rather than by hand.
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
