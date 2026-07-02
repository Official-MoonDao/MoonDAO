// Texture resolution ladder for the Lunar Atlas globe.
//
// The globe loads a low-res color map first for fast first paint, then upgrades
// to a higher-res map once it decodes. Displacement (LOLA DEM) doubles as the
// bump map for surface shading. To ship higher-fidelity assets, drop the files
// in `public/lunar-atlas/` and extend these arrays — no component changes.

export type TextureTier = {
  color: string
  // Approximate longest-edge pixel dimension, for choosing sphere tessellation.
  colorMaxPx: number
}

// Ordered lowest -> highest fidelity.
export const COLOR_TIERS: TextureTier[] = [
  { color: '/lunar-atlas/lunar_color_2k.jpg', colorMaxPx: 2048 },
  { color: '/lunar-atlas/lunar_color_4k.jpg', colorMaxPx: 4096 },
  { color: '/lunar-atlas/lunar_color_8k.jpg', colorMaxPx: 8192 },
]

// First paint uses the lowest tier; the default "settled" tier balances
// fidelity and weight. The top tier loads on demand (drill-in / zoom).
export const FIRST_PAINT_COLOR = COLOR_TIERS[0].color
export const DEFAULT_COLOR = COLOR_TIERS[1].color
export const HIGH_DETAIL_COLOR = COLOR_TIERS[COLOR_TIERS.length - 1].color

export const DISPLACEMENT_MAP = '/lunar-atlas/lunar_displacement_2k.jpg'
export const DISPLACEMENT_MAP_HIGH = '/lunar-atlas/lunar_displacement_4k.jpg'

// Ordered lowest -> highest fidelity, mirroring COLOR_TIERS. The 4K DEM loads
// only when the scene is in high-detail mode (drill-in).
export const DISPLACEMENT_TIERS: string[] = [
  DISPLACEMENT_MAP,
  DISPLACEMENT_MAP_HIGH,
]

// Globe render radius in scene units. Markers/models place against this.
export const GLOBE_RADIUS = 2

// Displacement scale in scene units. Real lunar relief is tiny relative to the
// radius; this is exaggerated for legibility but kept subtle enough to read as
// the Moon, not a golf ball.
export const DISPLACEMENT_SCALE = 0.06

// The LOLA DEM's mid-gray is the mean lunar radius, so displacement is applied
// centered: lowlands sink below GLOBE_RADIUS and highlands rise above it.
// Without this bias the whole surface is only ever raised, which buries
// anything seated at the analytic sphere radius.
export const DISPLACEMENT_BIAS = -DISPLACEMENT_SCALE / 2
