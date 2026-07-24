// Baked terrain assets for Moon Base Zero.
//
// The scene renders a single 16x16 km patch of the Shackleton-de Gerlache
// connecting ridge, baked at 5 m/px from the PGDA Site01 LOLA DEM by
// scripts/build-southpole-assets.py — heights land in a 16-bit R/G-split PNG
// (8-bit displacement banded visibly at this zoom) plus a hillshaded albedo
// (the terrain material is unlit; the bake IS the lighting). The matching
// projection math and BAKED constants live in ./southpole.ts.

export const SP_HEIGHT_MAP = '/moonbase/southpole/height_rg.png'
export const SP_ALBEDO_MAP = '/moonbase/southpole/albedo.jpg'

// World radius in scene units. Terrain, markers, and camera framings are all
// expressed against this — the world is still a sphere (positions are
// directions scaled by a radius), only the rendered patch is the ridge.
export const GLOBE_RADIUS = 2
