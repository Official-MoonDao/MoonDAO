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

Outputs (into ui/public/moonbase/southpole/):
  height_rg.png  16-bit height field split across R (high byte) and G (low
                 byte), normalized to the patch's [min, max].
  albedo.jpg     Neutral regolith albedo with the hillshade lighting BAKED in
                 (terrain material is unlit in the scene) + cavity + grain.

It prints the constants that must match ui/lib/lunar-atlas/southpole.ts.

Usage:
  python3 build-southpole-assets.py /path/to/Site01_final_adj_5mpp_surf.tif <out_dir>
"""

import sys
import numpy as np
import tifffile
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter

MAP_SCALE_M = 5.0  # meters per pixel
MOON_RADIUS_M = 1737400.0

# GeoTIFF registration (ModelTiepointTag): pixel (0,0) sits at polar
# stereographic (X, Y) = (TIE_X, TIE_Y); X grows right, Y shrinks downward.
TIE_X = -19000.0
TIE_Y = -4000.0

# True scale — the base models are 1:1, so the ground is too.
EXAGGERATION = 1.0

HEIGHT_OUT = 1600  # 10 m/px effective heights; the render mesh can't use more
# Shading is baked at 2.5 m/px — beyond the DEM's native 5 m/px, but the
# extra octave carries the SYNTHETIC detail (craters, hummocks, grain) that
# the track-interpolated LOLA data is missing. Without it the ground reads
# as smooth plaster from a few hundred meters up.
ALBEDO_OUT = 6400

# Baked hillshade sun. Azimuth 40 deg = light arriving from lon 40E in the
# polar stereographic frame (image up = +Y); MUST match the scene sun in
# MoonGlobe.tsx. 45 deg elevation is the standard cartographic hillshade sun.
SUN_AZ_DEG = 40.0
SUN_EL_DEG = 45.0


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


def hillshade(h: np.ndarray, px_m: float) -> np.ndarray:
    """Relative illumination under the baked sun (flat ground = 1.0).

    The terrain material is UNLIT in the scene, so this bake IS the terrain
    lighting: the DEM's full 5 m/px relief becomes per-pixel shading, far
    beyond what the displaced mesh could resolve.
    """
    gy, gx = np.gradient(h, px_m)
    nx = -gx * EXAGGERATION
    ny = gy * EXAGGERATION  # +y = image up = -line axis
    norm = np.sqrt(nx * nx + ny * ny + 1.0)
    az = np.radians(SUN_AZ_DEG)
    el = np.radians(SUN_EL_DEG)
    lx, ly, lz = np.sin(az) * np.cos(el), np.cos(az) * np.cos(el), np.sin(el)
    shade = np.clip((nx * lx + ny * ly + lz) / norm, 0.0, None)
    rel = (shade / np.sin(el)) ** 0.85  # flat ground -> 1.0; gamma softens
    # Compressed range: sunward slopes must not saturate to paper-white and
    # away slopes stay readable, never black (the "ponds" failure mode).
    return np.clip(0.30 + 0.70 * rel, 0.24, 1.42)


def micro_relief(size: int, px_m: float, seed: int) -> np.ndarray:
    """Synthetic sub-track roughness (meters) for shading only.

    LOLA 5 m/px grids are interpolated from sparse altimeter tracks, so the
    ground between tracks is unnaturally smooth. Real regolith is saturated
    with meter-scale craters and hummocks; band-passed noise stands in for
    them. Shading only — never added to the exported heights, so geometry
    and model seating stay faithful to the real DEM.
    """
    rng = np.random.default_rng(seed)
    out = np.zeros((size, size), dtype=np.float32)
    # (wavelength m, amplitude m) — tuned for a 16 km patch viewed from ~500 m.
    for wl_m, amp_m in ((15.0, 0.25), (40.0, 0.6), (140.0, 1.4), (450.0, 3.0)):
        sigma = max(wl_m / px_m / 2.0, 0.6)
        n = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
        n = gaussian_filter(n, sigma)
        n /= max(float(n.std()), 1e-6)
        out += n * amp_m
    return out


def crater_field(size: int, px_m: float, seed: int) -> np.ndarray:
    """Synthetic small-crater population (meters) for shading only.

    Real lunar ground is saturated with craters below the DEM's effective
    resolution — they, not noise, are what makes regolith read as regolith.
    Paint a power-law population of degraded bowls (raised rim, parabolic
    floor) into the shading height field. Like micro_relief, this is never
    added to the exported heights.
    """
    rng = np.random.default_rng(seed)
    h = np.zeros((size, size), dtype=np.float32)
    n = 45000
    d_min, d_max = 6.0, 600.0
    alpha = 1.8  # cumulative size-frequency slope: many small, few large
    u = rng.random(n)
    diam = d_min * (1 - u * (1 - (d_min / d_max) ** alpha)) ** (-1 / alpha)
    xs = rng.random(n) * size
    ys = rng.random(n) * size
    # Mostly old, softened craters; the occasional crisper one.
    depth_frac = rng.uniform(0.05, 0.22, n)
    for i in range(n):
        r_px = diam[i] / 2 / px_m
        if r_px < 1.1:
            continue  # sub-pixel; the grain octaves cover these
        cx, cy = xs[i], ys[i]
        pad = r_px * 1.4
        x0, x1 = max(int(cx - pad), 0), min(int(np.ceil(cx + pad)), size)
        y0, y1 = max(int(cy - pad), 0), min(int(np.ceil(cy + pad)), size)
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1]
        r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r_px
        depth_m = depth_frac[i] * diam[i]
        bowl = np.where(r < 1.0, -(1.0 - r * r), 0.0)
        rim = np.where((r >= 1.0) & (r < 1.4), 0.3 * (1.4 - r) / 0.4, 0.0)
        h[y0:y1, x0:x1] += ((bowl + rim) * depth_m).astype(np.float32)
    return h


def bake_albedo(h: np.ndarray, px_m: float, size: int, seed: int) -> np.ndarray:
    """Regolith albedo: baked hillshade * cavity shading * fine grain."""
    h_alb = resize_f(h, size) if h.shape[0] != size else h
    alb_px_m = px_m * (h.shape[0] / size)

    def cavity(sigma_m: float) -> np.ndarray:
        return h_alb - gaussian_filter(h_alb, sigma_m / alb_px_m)

    # Crater floors / pits read darker, rims lighter (a cheap AO proxy).
    cav = cavity(250.0) / 80.0 + cavity(1200.0) / 350.0
    cav = np.clip(cav, -1.2, 1.2)

    rng = np.random.default_rng(seed)
    grain = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
    grain = gaussian_filter(grain, 1.0)
    grain2 = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
    grain2 = gaussian_filter(grain2, 4.0)

    craters = crater_field(size, alb_px_m, seed + 200)
    # Crater floors trap shadow — darken them beyond what hillshade gives.
    crater_ao = np.clip(craters / 8.0, -1.2, 0.6)

    base = np.clip(
        0.62 + cav * 0.05 + crater_ao * 0.06 + grain * 0.025 + grain2 * 0.03,
        0.3,
        0.9,
    )
    h_shade = h_alb + micro_relief(size, alb_px_m, seed + 100) + craters
    return np.clip(base * hillshade(h_shade, alb_px_m), 0.05, 0.98)


def tint_and_save(base: np.ndarray, path: str) -> None:
    img = np.zeros((*base.shape, 3), dtype=np.uint8)
    # Slightly warm-gray regolith.
    img[..., 0] = np.clip(base * 255 * 1.000, 0, 255)
    img[..., 1] = np.clip(base * 255 * 0.988, 0, 255)
    img[..., 2] = np.clip(base * 255 * 0.955, 0, 255)
    Image.fromarray(img).save(path, quality=90)


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

    tint_and_save(
        bake_albedo(dem, MAP_SCALE_M, ALBEDO_OUT, seed=7),
        f'{out_dir}/albedo.jpg',
    )
    print('wrote albedo.jpg')

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
