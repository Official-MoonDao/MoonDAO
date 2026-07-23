// Baked south-pole terrain assets for the Lunar Atlas.
//
// The scene renders a photorealistic polar cap (not a whole-Moon sphere):
// every real program in the dataset targets the south pole. Assets are baked
// from the NASA LRO/LOLA LDEM_75S_120M DEM by scripts/build-southpole-assets.py
// — heights land in a 16-bit R/G-split PNG (8-bit displacement banded visibly
// at this zoom), plus a tangent-space normal map and a cavity-shaded albedo.
// The matching projection math and BAKED constants live in ./southpole.ts.

// Inner cap (playable area, ~369 km square centered on the pole).
export const SP_HEIGHT_MAP = '/moonbase/southpole/height_rg.png'
export const SP_NORMAL_MAP = '/moonbase/southpole/normal.png'
export const SP_ALBEDO_MAP = '/moonbase/southpole/albedo.jpg'

// Far surround (full DEM extent, ~915 km square; albedo and heights feather
// out toward the dataset edge so the cap dissolves into the backdrop Moon).
export const SP_FAR_HEIGHT_MAP = '/moonbase/southpole/far_height_rg.png'
export const SP_FAR_ALBEDO_MAP = '/moonbase/southpole/far_albedo.jpg'

// Whole-Moon backdrop sphere under the caps (NASA CGI Moon Kit, equirect):
// the horizon past the cap is the actual Moon's limb, not empty space.
export const MOON_COLOR_MAP = '/moonbase/lunar_color_4k.jpg'
export const MOON_BUMP_MAP = '/moonbase/lunar_displacement_2k.jpg'

// World radius in scene units. Terrain, markers, and camera framings are all
// expressed against this — the world is still a sphere (positions are
// directions scaled by a radius), only the rendered patch is polar.
export const GLOBE_RADIUS = 2
