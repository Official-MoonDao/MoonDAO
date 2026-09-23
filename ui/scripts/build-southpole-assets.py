#!/usr/bin/env python3
"""Bake Moon Base Zero terrain assets for the Shackleton Connecting Ridge.

Input: Site01_final_adj_5mpp_surf.tif — NASA GSFC PGDA "Improved LOLA
Elevation Maps for South Pole Landing Sites" (Barker et al. 2021), Site01 =
the Shackleton-de Gerlache connecting ridge. 3200x3200 float32 GeoTIFF,
5 m/px, south polar stereographic X/Y meters (MOON_ME frame), heights in
meters relative to the 1737.4 km sphere. Download:
  https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif

The scene is a single 16x16 km patch centered on the ridge — no whole-Moon,
no polar cap. Heights are 1:1 (no vertical exaggeration): the moonbase
models are placed at true scale, so the ground must be too.

Output (into ui/public/moonbase/southpole/):
  height_rg.png  16-bit height field split across R (high byte) and G (low
                 byte), normalized to the patch's [min, max].

Heights are the ONLY output. This script used to also bake a 6400x6400 albedo
with a hillshade, a synthetic crater population, and grain painted into it,
because the terrain was rendered unlit and that image WAS the lighting. The
terrain now evaluates the regolith BRDF per pixel against the real sun
(components/lunar-atlas/SouthPoleTerrain.tsx), which made the bake wrong in two
separate ways, each sufficient on its own to delete it:

  - It shades twice. A baked hillshade multiplied by computed light darkens a
    slope once for the sun that was baked and again for the sun that is actually
    there, and the baked one can never move.
  - It invents craters. Most of the albedo's apparent realism came from a random
    power-law crater field, which at its upper end painted a few hundred bowls
    over 100 m across — and a few dozen over 300 m — onto a real, published,
    checkable DEM of a real place. Detail below the DEM's resolution is honest
    gap-filling; features that large are not, and they belong nowhere near an
    asset derived from LOLA. Sub-resolution texture is now a procedural normal
    tile generated in the renderer, where it is unmistakably synthetic.

It prints the constants that must match ui/lib/lunar-atlas/southpole.ts.

Usage:
  python3 build-southpole-assets.py /path/to/Site01_final_adj_5mpp_surf.tif <out_dir>
"""

import sys
import numpy as np
import tifffile
from PIL import Image
from scipy.ndimage import distance_transform_edt

MAP_SCALE_M = 5.0  # meters per pixel
MOON_RADIUS_M = 1737400.0

# GeoTIFF registration (ModelTiepointTag): pixel (0,0) sits at polar
# stereographic (X, Y) = (TIE_X, TIE_Y); X grows right, Y shrinks downward.
TIE_X = -19000.0
TIE_Y = -4000.0

# True scale — the base models are 1:1, so the ground is too.
EXAGGERATION = 1.0

# 10 m/px heights. Deliberately NOT the DEM's native 5 m/px, and that is a
# browser budget rather than a renderer limitation: at 3200x3200 the CPU-side
# height field is 19.5 MB and the transient canvas used to decode it is another
# 39 MB, which is the kind of spike that ends a mobile tab. Little real
# information is lost — LOLA's 5 m grids are interpolated from sparse altimeter
# tracks, so the true resolution of the source is already coarser than its
# posting.
HEIGHT_OUT = 1600


def encode_height_rg(h: np.ndarray, h_min: float, h_max: float) -> Image.Image:
    norm16 = np.round((h - h_min) / (h_max - h_min) * 65535.0)
    norm16 = np.clip(norm16, 0, 65535).astype(np.uint32)
    rg = np.zeros((*h.shape, 3), dtype=np.uint8)
    rg[..., 0] = (norm16 >> 8).astype(np.uint8)
    rg[..., 1] = (norm16 & 0xFF).astype(np.uint8)
    return Image.fromarray(rg)


def resize_f(a: np.ndarray, size: int) -> np.ndarray:
    return np.asarray(
        Image.fromarray(a.astype(np.float32), mode='F').resize(
            (size, size), Image.BILINEAR
        )
    )


def main() -> None:
    src_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else '.'

    dem = tifffile.imread(src_path).astype(np.float32)
    assert dem.shape[0] == dem.shape[1], f'expected square DEM, got {dem.shape}'
    size_px = dem.shape[0]
    extent_m = size_px * MAP_SCALE_M

    # Fill any nodata (NaN) with the nearest valid height — the "surf"
    # product is interpolated, but guard the off-ROI corners anyway.
    nan_mask = np.isnan(dem)
    if nan_mask.any():
        idx = distance_transform_edt(
            nan_mask, return_distances=False, return_indices=True
        )
        dem = dem[tuple(idx)]
        print(f'filled {int(nan_mask.sum())} nodata px from nearest neighbors')

    h_min, h_max = float(dem.min()), float(dem.max())

    # Patch center in polar stereographic meters (X right, Y up in image).
    center_x = TIE_X + extent_m / 2
    center_y = TIE_Y - extent_m / 2
    # Center height: what the scene should treat as the base's ground level.
    ci = size_px // 2
    center_h = float(dem[ci, ci])

    encode_height_rg(resize_f(dem, HEIGHT_OUT), h_min, h_max).save(
        f'{out_dir}/height_rg.png', optimize=True
    )
    print('wrote height_rg.png')

    print('\n---- constants for ui/lib/lunar-atlas/southpole.ts ----')
    print(f'CAP_EXTENT_M = {extent_m:.0f}')
    print(f'CAP_CENTER_X_M = {center_x:.0f}')
    print(f'CAP_CENTER_Y_M = {center_y:.0f}')
    print(f'CAP_HEIGHT_MIN_M = {h_min:.1f}')
    print(f'CAP_HEIGHT_MAX_M = {h_max:.1f}')
    print(f'CAP_CENTER_HEIGHT_M = {center_h:.1f}')
    print(f'EXAGGERATION = {EXAGGERATION}')


if __name__ == '__main__':
    main()
