// Baked terrain assets for Moon Base Zero.
//
// The scene renders a single 16x16 km patch of the Shackleton-de Gerlache
// connecting ridge, baked at 5 m/px from the PGDA Site01 LOLA DEM by
// scripts/build-southpole-assets.py. Heights are the ONLY thing shipped: they
// land in a 16-bit R/G-split PNG (8-bit displacement banded visibly at this
// zoom), and everything else the ground needs — normals, and therefore all of
// its shading — is derived from them at load. The matching projection math and
// BAKED constants live in ./southpole.ts.
//
// There used to be a second asset here, a 6.2 MB albedo with a hillshade baked
// into it, because the terrain material was unlit and the bake WAS the lighting.
// Now that the BRDF is evaluated per pixel against the real sun, a baked
// hillshade is not merely redundant but wrong: it would shade the ground a
// second time, from a sun that cannot move. Its removal is also most of why
// this scene got lighter rather than heavier while getting more physical.

export const SP_HEIGHT_MAP = '/moonbase/southpole/height_rg.png'

// World radius in scene units. Terrain, markers, and camera framings are all
// expressed against this — the world is still a sphere (positions are
// directions scaled by a radius), only the rendered patch is the ridge.
export const GLOBE_RADIUS = 2
