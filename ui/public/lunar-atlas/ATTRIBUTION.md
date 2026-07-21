# Lunar Atlas — texture attribution

All terrain assets are derived from **public-domain NASA data**.

## South-pole terrain (`southpole/`)

Baked from the **LOLA Gridded Data Record `LDEM_75S_120M`** — a 120 m/px
polar stereographic elevation model of the lunar south pole (75°S–90°S) from
the Lunar Orbiter Laser Altimeter aboard Lunar Reconnaissance Orbiter.
Source: [LOLA PDS Data Node](https://imbrium.mit.edu/)
(`DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_120M.IMG`, LRO-L-LOLA-4-GDR-V1.0).

| File | Derivation |
|---|---|
| `height_rg.png` | Inner cap (~369 km square): 16-bit heights split across the R (high byte) / G (low byte) channels, normalized to the crop's height range. |
| `normal.png` | Tangent-space normal map from full-resolution DEM gradients (2× vertical exaggeration, matching the rendered geometry). |
| `albedo.jpg` | Synthesized neutral-regolith albedo with cavity/ambient shading baked from the DEM (lunar regolith is near-uniform albedo; there is no usable optical imagery of the permanently-shadowed pole). |
| `far_height_rg.png`, `far_albedo.jpg` | Full DEM extent (~915 km square) at reduced resolution for the horizon surround; albedo fades to black before the dataset edge. |

Rebuild with `ui/scripts/build-southpole-assets.py` (documents the exact
pipeline and the constants shared with `ui/lib/lunar-atlas/southpole.ts`).

- **Elevation:** Lunar Orbiter Laser Altimeter (LOLA), NASA / GSFC —
  Smith, D. E., et al.
- **License:** NASA data is generally not copyrighted and is free to use (see
  [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
