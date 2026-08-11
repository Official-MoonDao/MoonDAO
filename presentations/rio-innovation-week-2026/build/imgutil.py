"""Image preprocessing helpers for the deck build.

Pre-crops source photos to exact aspect ratios (so python-pptx never has to
stretch/distort an image) and produces circular-masked headshot badges.
Outputs are cached in build/_cache/ next to this script.
"""
import os
from PIL import Image, ImageDraw, ImageOps, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
CACHE = os.path.join(HERE, '_cache')
os.makedirs(CACHE, exist_ok=True)


def _src(name):
    return os.path.join(ASSETS, name)


def _flat(name):
    """Flatten a (possibly nested) asset name into a safe cache-file stem."""
    return os.path.splitext(name)[0].replace(os.sep, '_').replace('/', '_')


def crop_to_ratio(name, ratio_w, ratio_h, focus=('center', 'center'), out_name=None):
    """Center/edge-crop an image to an exact width:height ratio. Returns cache path."""
    out_name = out_name or f"{_flat(name)}_r{ratio_w}x{ratio_h}.png"
    out_path = os.path.join(CACHE, out_name)
    if os.path.exists(out_path):
        return out_path
    im = Image.open(_src(name)).convert('RGB')
    w, h = im.size
    target_ratio = ratio_w / ratio_h
    cur_ratio = w / h
    if cur_ratio > target_ratio:
        new_w = int(h * target_ratio)
        new_h = h
    else:
        new_w = w
        new_h = int(w / target_ratio)
    fx, fy = focus
    if fx == 'left':
        x0 = 0
    elif fx == 'right':
        x0 = w - new_w
    else:
        x0 = (w - new_w) // 2
    if fy == 'top':
        y0 = 0
    elif fy == 'bottom':
        y0 = h - new_h
    else:
        y0 = (h - new_h) // 2
    im2 = im.crop((x0, y0, x0 + new_w, y0 + new_h))
    im2.save(out_path)
    return out_path


def circle_badge(name, size=800, border_color=None, border_px=0, out_name=None):
    """Square-crop + circular-mask an image into a transparent-background PNG badge."""
    border_tag = ''
    if border_color and border_px > 0:
        border_tag = f"_b{border_px}-{'-'.join(str(c) for c in border_color)}"
    out_name = out_name or f"{_flat(name)}_circle_s{size}{border_tag}.png"
    out_path = os.path.join(CACHE, out_name)
    if os.path.exists(out_path):
        return out_path
    im = Image.open(_src(name)).convert('RGB')
    w, h = im.size
    s = min(w, h)
    x0 = (w - s) // 2
    y0 = (h - s) // 2
    im = im.crop((x0, y0, x0 + s, y0 + s)).resize((size, size), Image.LANCZOS)

    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    pad = border_px
    draw.ellipse((pad, pad, size - pad, size - pad), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1))

    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)

    if border_color and border_px > 0:
        ring = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        rd.ellipse((border_px // 2, border_px // 2, size - border_px // 2, size - border_px // 2),
                    outline=border_color, width=border_px)
        out = Image.alpha_composite(out, ring)

    out.save(out_path)
    return out_path


def darken(name, factor=0.45, ratio=None, out_name=None):
    """Darken an image (for text-over-photo section dividers), optional ratio crop first."""
    src_name = name
    if ratio:
        src_path = crop_to_ratio(name, *ratio)
    else:
        src_path = _src(name)
    ratio_tag = f"_r{ratio[0]}x{ratio[1]}" if ratio else ''
    out_name = out_name or f"{_flat(name)}_dark_f{factor}{ratio_tag}.png"
    out_path = os.path.join(CACHE, out_name)
    if os.path.exists(out_path):
        return out_path
    im = Image.open(src_path).convert('RGB')
    overlay = Image.new('RGB', im.size, (10, 14, 30))
    im2 = Image.blend(im, overlay, 1 - factor)
    im2.save(out_path)
    return out_path


def rounded_rect_mask(name, ratio, radius_frac=0.05, out_name=None):
    """Crop to ratio and apply rounded-rect alpha mask (transparent PNG)."""
    path = crop_to_ratio(name, *ratio)
    out_name = out_name or f"{_flat(name)}_rounded.png"
    out_path = os.path.join(CACHE, out_name)
    if os.path.exists(out_path):
        return out_path
    im = Image.open(path).convert('RGB')
    w, h = im.size
    radius = int(min(w, h) * radius_frac)
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    out.save(out_path)
    return out_path
