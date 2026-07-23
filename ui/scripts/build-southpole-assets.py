#!/usr/bin/env python3
"""Bake Lunar Atlas south-pole terrain assets from the LOLA LDEM_75S_120M DEM.

Input: LDEM_75S_120M.IMG (NASA LRO/LOLA gridded DEM, polar stereographic,
120 m/px true at the pole, int16 LSB, 7624x7624, heights in 0.5 m units
relative to the 1737.4 km reference sphere). Download:
  http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_120M.IMG

Outputs (into ui/public/moonbase/southpole/):
  height_rg.png      Inner cap 16-bit height field split across R (high byte)
                     and G (low byte), normalized to the crop's [min, max].
  normal.png         Inner cap tangent-space normal map (full-res gradients).
  albedo.jpg         Inner cap neutral regolith albedo w/ baked cavity + grain.
  far_height_rg.png  Full-extent (15 deg colat) height field, same encoding.
  far_albedo.jpg     Full-extent albedo with a radial fade to black past the
                     playable area (hides the dataset edge).

It prints the constants that must match ui/lib/lunar-atlas/southpole.ts.

Usage:
  python3 build-southpole-assets.py /path/to/LDEM_75S_120M.IMG <out_dir>
"""

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SRC_SIZE = 7624
# Pole pixel (0-based). PDS LINE/SAMPLE_PROJECTION_OFFSET = 3811.5 (1-based).
SRC_CENTER = 3811.5
MAP_SCALE_M = 120.0  # meters per pixel, true at the pole
HEIGHT_UNIT_M = 0.5  # int16 DN -> meters
MOON_RADIUS_M = 1737400.0

# Inner crop half-width in source pixels, centered on the pole.
# 1536 px * 120 m = 184.3 km from the pole (~6.08 deg of arc) — covers every
# seed site (all poleward of -85 lat) with margin.
CROP_HALF = 1536

# Vertical exaggeration the scene applies to geometry. The normal map bakes
# the same factor so per-pixel shading agrees with the displaced mesh.
EXAGGERATION = 2.0

INNER_HEIGHT_OUT = 1536
# Albedo/normals at the DEM's native resolution (3072 px over the crop) —
# anything more is upscaling noise, anything less blurs drill-in views.
INNER_NORMAL_OUT = 3072
INNER_ALBEDO_OUT = 3072
FAR_HEIGHT_OUT = 512
FAR_ALBEDO_OUT = 1536

# Radial fade of the far albedo (in degrees of colatitude): full detail
# inside FADE_START, easing to a flat tone past FADE_END. The scene renders
# a whole-Moon backdrop sphere (real LROC color map) beneath the caps, so
# the fade target matches that texture's measured south-polar tone — the cap
# dissolves into the Moon, not into a gray void.
FAR_FADE_START_DEG = 11.0
FAR_FADE_END_DEG = 14.6
# Scalar tone that, after tint_and_save's warm-gray channel tints, lands on
# the LROC map's measured south-polar RGB of ~(0.67, 0.66, 0.64).
FAR_FADE_TONE = 0.672

# Baked hillshade sun. Azimuth 40 deg = light arriving from lon 40E (image
# frame: up = lon 0, right = lon 90E); MUST match the scene sun's longitude
# in MoonGlobe.tsx. 45 deg elevation is the standard cartographic hillshade
# sun: relief stays crisp but big sunward slopes don't blow out to white and
# away slopes don't collapse to black (the "ponds" failure mode).
SUN_AZ_DEG = 40.0
SUN_EL_DEG = 45.0


def colat_deg_of_radius_m(r_m: np.ndarray | float):
    return np.degrees(2 * np.arctan(np.asarray(r_m) / (2 * MOON_RADIUS_M)))


def resize_f(a: np.ndarray, size: int) -> np.ndarray:
    return np.asarray(
        Image.fromarray(a.astype(np.float32), mode='F').resize(
            (size, size), Image.BILINEAR
        )
    )


def encode_height_rg(h: np.ndarray, h_min: float, h_max: float) -> Image.Image:
    norm16 = np.round((h - h_min) / (h_max - h_min) * 65535.0)
    norm16 = np.clip(norm16, 0, 65535).astype(np.uint32)
    rg = np.zeros((*h.shape, 3), dtype=np.uint8)
    rg[..., 0] = (norm16 >> 8).astype(np.uint8)
    rg[..., 1] = (norm16 & 0xFF).astype(np.uint8)
    return Image.fromarray(rg)


def hillshade(h: np.ndarray, px_m: float) -> np.ndarray:
    """Relative illumination of the surface under the baked sun (flat = 1.0).

    This is what makes the map read as crisp lunar terrain: the DEM's full
    120 m/px relief becomes per-pixel shading in the albedo, far below what
    the mesh could resolve. The terrain materials are UNLIT in the scene, so
    this bake IS the terrain lighting.
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
    # Compressed range: sunward slopes must not saturate to paper-white
    # (base 0.62 * 1.42 < 1) and away slopes stay readable, never black.
    return np.clip(0.30 + 0.70 * rel, 0.24, 1.42)


def micro_relief(size: int, px_m: float, seed: int) -> np.ndarray:
    """Synthetic sub-DEM roughness (meters) for shading only.

    The LOLA grid bottoms out at 120 m/px, so gentle plains between craters
    are perfectly smooth in the data and hillshade to featureless gray
    "ponds". Real regolith at these scales is saturated with small craters
    and hummocks; three octaves of band-passed noise stand in for them.
    Never added to the exported height fields — geometry and seating stay
    faithful to the real DEM.
    """
    rng = np.random.default_rng(seed)
    out = np.zeros((size, size), dtype=np.float32)
    # (wavelength m, amplitude m): subtle at 500 m, broader hummocks at 4 km.
    for wl_m, amp_m in ((500.0, 6.0), (1500.0, 14.0), (4000.0, 26.0)):
        sigma = max(wl_m / px_m / 2.0, 0.6)
        n = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
        n = gaussian_filter(n, sigma)
        n /= max(float(n.std()), 1e-6)
        out += n * amp_m
    return out


def bake_albedo(h: np.ndarray, px_m: float, size: int, seed: int) -> np.ndarray:
    """Regolith albedo: baked hillshade * cavity shading * fine grain.

    Lunar regolith is near-uniform albedo; all the visual structure comes
    from shape. Hillshade (over the DEM plus synthetic micro-relief) supplies
    the crisp lighting; height below the blurred neighborhood (crater floors,
    pits) reads darker and rims lighter (a cheap AO proxy); two octaves of
    grain keep magnified close-ups from smearing.
    """
    h_alb = resize_f(h, size)
    alb_px_m = px_m * (h.shape[0] / size)

    def cavity(sigma_m: float) -> np.ndarray:
        return h_alb - gaussian_filter(h_alb, sigma_m / alb_px_m)

    cav = cavity(2000.0) / 600.0 + cavity(12000.0) / 2500.0
    cav = np.clip(cav, -1.2, 1.2)

    rng = np.random.default_rng(seed)
    grain = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
    grain = gaussian_filter(grain, 1.0)
    grain2 = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
    grain2 = gaussian_filter(grain2, 4.0)

    base = np.clip(0.62 + cav * 0.05 + grain * 0.025 + grain2 * 0.03, 0.3, 0.9)
    h_shade = h_alb + micro_relief(size, alb_px_m, seed + 100)
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

    raw = np.fromfile(src_path, dtype='<i2')
    assert raw.size == SRC_SIZE * SRC_SIZE, f'unexpected size {raw.size}'
    dem = raw.reshape(SRC_SIZE, SRC_SIZE).astype(np.float32) * HEIGHT_UNIT_M

    # ======================= inner cap =======================
    # Slice so the pole (source px 3811.5) lands at the exact crop center.
    c = int(SRC_CENTER + 0.5)  # 3812
    crop = dem[c - CROP_HALF : c + CROP_HALF, c - CROP_HALF : c + CROP_HALF]
    h_min, h_max = float(crop.min()), float(crop.max())
    extent_m = crop.shape[0] * MAP_SCALE_M
    colat_edge = colat_deg_of_radius_m(extent_m / 2)

    Image.fromarray(
        np.asarray(encode_height_rg(
            resize_f(crop, INNER_HEIGHT_OUT), h_min, h_max
        ))
    ).save(f'{out_dir}/height_rg.png', optimize=True)
    print('wrote height_rg.png')

    # Normal map from full-res gradients, then downsample the components.
    # Tangent frame: +x = image right (+sample), +y = image up, z = out.
    gy, gx = np.gradient(crop, MAP_SCALE_M)  # d h / d meters (down, right)
    nx = -gx * EXAGGERATION
    ny = gy * EXAGGERATION  # image up = -line axis, so dh/d(up) = -gy
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / length, ny / length, nz / length

    nrm = np.zeros((INNER_NORMAL_OUT, INNER_NORMAL_OUT, 3), dtype=np.uint8)
    nrm[..., 0] = np.clip((resize_f(nx, INNER_NORMAL_OUT) * 0.5 + 0.5) * 255, 0, 255)
    nrm[..., 1] = np.clip((resize_f(ny, INNER_NORMAL_OUT) * 0.5 + 0.5) * 255, 0, 255)
    nrm[..., 2] = np.clip((resize_f(nz, INNER_NORMAL_OUT) * 0.5 + 0.5) * 255, 0, 255)
    Image.fromarray(nrm).save(f'{out_dir}/normal.png', optimize=True)
    print('wrote normal.png')

    tint_and_save(
        bake_albedo(crop, MAP_SCALE_M, INNER_ALBEDO_OUT, seed=7),
        f'{out_dir}/albedo.jpg',
    )
    print('wrote albedo.jpg')

    # ======================= far surround =======================
    # Full dataset extent (to colat ~15 deg at the edges). Trim one row/col so
    # the pole is centered, matching the inner crop's registration.
    half_far = min(c, SRC_SIZE - c)  # 3812
    far = dem[c - half_far : c + half_far, c - half_far : c + half_far].copy()
    far_extent_m = far.shape[0] * MAP_SCALE_M
    far_colat_edge = colat_deg_of_radius_m(far_extent_m / 2)

    # Feather the far heights to the datum (0 m) toward the dataset edge so
    # the cap's rim lands exactly on the backdrop sphere's radius instead of
    # ending in a ±7 km cliff silhouette.
    fx = (np.arange(far.shape[0]) + 0.5) / far.shape[0] - 0.5
    fxx, fyy = np.meshgrid(fx, fx)
    far_colat = colat_deg_of_radius_m(np.sqrt(fxx**2 + fyy**2) * far_extent_m)
    keep = np.clip(
        (FAR_FADE_END_DEG - far_colat) / (FAR_FADE_END_DEG - FAR_FADE_START_DEG),
        0,
        1,
    ).astype(np.float32)
    far *= keep

    far_min, far_max = float(far.min()), float(far.max())

    encode_height_rg(resize_f(far, FAR_HEIGHT_OUT), far_min, far_max).save(
        f'{out_dir}/far_height_rg.png', optimize=True
    )
    print('wrote far_height_rg.png')

    far_base = bake_albedo(far, MAP_SCALE_M, FAR_ALBEDO_OUT, seed=11)
    # Radial fade toward the backdrop Moon's polar tone past the playable
    # area (the heights feather to the datum over the same band, so both the
    # shape and the shading dissolve together).
    ax = (np.arange(FAR_ALBEDO_OUT) + 0.5) / FAR_ALBEDO_OUT - 0.5
    xx, yy = np.meshgrid(ax, ax)
    colat = colat_deg_of_radius_m(np.sqrt(xx * xx + yy * yy) * far_extent_m)
    fade = np.clip(
        (FAR_FADE_END_DEG - colat) / (FAR_FADE_END_DEG - FAR_FADE_START_DEG),
        0,
        1,
    )
    tint_and_save(
        far_base * fade + FAR_FADE_TONE * (1 - fade), f'{out_dir}/far_albedo.jpg'
    )
    print('wrote far_albedo.jpg')

    print('\n---- constants for ui/lib/lunar-atlas/southpole.ts ----')
    print(f'INNER_EXTENT_M = {extent_m:.0f}')
    print(f'INNER_COLAT_EDGE_DEG = {colat_edge:.4f}')
    print(f'INNER_HEIGHT_MIN_M = {h_min:.1f}')
    print(f'INNER_HEIGHT_MAX_M = {h_max:.1f}')
    print(f'FAR_EXTENT_M = {far_extent_m:.0f}')
    print(f'FAR_COLAT_EDGE_DEG = {far_colat_edge:.4f}')
    print(f'FAR_HEIGHT_MIN_M = {far_min:.1f}')
    print(f'FAR_HEIGHT_MAX_M = {far_max:.1f}')
    print(f'EXAGGERATION = {EXAGGERATION}')


if __name__ == '__main__':
    main()
