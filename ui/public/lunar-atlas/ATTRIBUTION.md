# Lunar Atlas — texture attribution

All globe textures are derived from **public-domain NASA data** via the
[NASA Scientific Visualization Studio "CGI Moon Kit" (SVS 4720)](https://svs.gsfc.nasa.gov/4720/).

| File | Source | Derivation |
|---|---|---|
| `lunar_color_2k.jpg`, `lunar_color_4k.jpg`, `lunar_color_8k.jpg` | LROC WAC global color mosaic (`lroc_color_poles_8k.tif`) | Converted to JPEG and downscaled (2K/4K) with `sips`. Equirectangular, seam at ±180° lon. |
| `lunar_displacement_2k.jpg`, `lunar_displacement_4k.jpg` | LOLA global DEM (`ldem_16_uint.tif`) | 16-bit height field flattened to 8-bit grayscale JPEG and downscaled. Used as both displacement (geometry relief) and bump (surface shading). |

- **Imagery:** Lunar Reconnaissance Orbiter Camera (LROC), Arizona State University / NASA / GSFC.
- **Elevation:** Lunar Orbiter Laser Altimeter (LOLA), NASA / GSFC.
- **License:** NASA imagery is generally not copyrighted and is free to use (see
  [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

Higher-resolution products can be dropped in without code changes — see
`ui/lib/lunar-atlas/textures.ts` for the resolution ladder the globe loads.
