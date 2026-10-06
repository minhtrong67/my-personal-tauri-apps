#!/usr/bin/env python3
"""Generate every Material Video Editor icon (Material Design 3 style) with Pillow.

Outputs into src-tauri/icons:
  32x32.png, 128x128.png, 128x128@2x.png, icon.png, icon.ico, icon.icns
  installer.ico, uninstaller.ico
  nsis-sidebar.bmp, nsis-header.bmp
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

S = 1024
SS = 2

PRIMARY = (103, 80, 164)
PRIMARY_LIGHT = (141, 112, 214)
PRIMARY_CONT = (234, 221, 255)
TERTIARY = (125, 82, 96)
TERTIARY_CONT = (255, 216, 228)
PAPER = (255, 255, 255)
SHADOW = (36, 18, 78)
GREY_A = (96, 92, 108)
GREY_B = (140, 136, 152)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = lerp(c1, c2, (x + y) / (2 * (size - 1)))
    return img


def draw_icon(uninstall=False):
    n = S * SS
    k = SS
    c1, c2 = (GREY_A, GREY_B) if uninstall else (PRIMARY, PRIMARY_LIGHT)
    accent = GREY_A if uninstall else PRIMARY
    stripe = (200, 197, 210) if uninstall else TERTIARY_CONT
    bg = gradient(n, c1, c2).convert("RGBA")
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, n - 1, n - 1), radius=int(0.225 * n), fill=255)
    base = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    base.paste(bg, (0, 0), mask)

    # clapperboard body geometry
    bx0, by0, bx1, by1 = 212 * k, 420 * k, 812 * k, 800 * k

    # soft shadow
    sh = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((bx0, by0 + 22 * k, bx1, by1 + 22 * k), radius=56 * k, fill=SHADOW + (95,))
    sh = sh.filter(ImageFilter.GaussianBlur(22 * k))
    base.alpha_composite(sh)
    d = ImageDraw.Draw(base)

    # board
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=56 * k, fill=PAPER)
    # play triangle
    cx, cy = (bx0 + bx1) // 2, (by0 + by1) // 2 + 6 * k
    r = 118 * k
    d.polygon([(cx - r * 0.55, cy - r), (cx - r * 0.55, cy + r), (cx + r * 1.0, cy)], fill=accent)
    d.rounded_rectangle((bx0 + 40 * k, by1 - 70 * k, bx0 + 240 * k, by1 - 42 * k), radius=14 * k, fill=PRIMARY_CONT if not uninstall else (225, 222, 232))

    # clapper bar (striped), rotated about its left hinge
    bar_w, bar_h = bx1 - bx0, 118 * k
    bar = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rounded_rectangle((0, 0, bar_w - 1, bar_h - 1), radius=34 * k, fill=accent if not uninstall else GREY_A)
    sw = 104 * k
    for i in range(-1, bar_w // sw + 3):
        x = i * sw * 2 - 20 * k
        bd.polygon([(x, bar_h), (x + sw, bar_h), (x + sw + bar_h * 0.55, 0), (x + bar_h * 0.55, 0)], fill=stripe)
    # keep rounded corners
    m = Image.new("L", (bar_w, bar_h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, bar_w - 1, bar_h - 1), radius=34 * k, fill=255)
    clipped = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    clipped.paste(bar, (0, 0), m)

    pad = 200 * k
    layer = Image.new("RGBA", (bar_w + 2 * pad, bar_h + 2 * pad), (0, 0, 0, 0))
    layer.paste(clipped, (pad, pad), clipped)
    layer = layer.rotate(14, center=(pad + 14 * k, pad + bar_h - 8 * k), resample=Image.BICUBIC)
    ox, oy = bx0 - pad, by0 - bar_h - 14 * k - pad
    tmp = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    tmp.paste(layer, (ox, oy), layer)
    base.alpha_composite(tmp)

    if uninstall:
        cxx, cyy, rr = 780 * k, 790 * k, 150 * k
        d = ImageDraw.Draw(base)
        d.ellipse((cxx - rr - 14 * k, cyy - rr - 14 * k, cxx + rr + 14 * k, cyy + rr + 14 * k), fill=GREY_A)
        d.ellipse((cxx - rr, cyy - rr, cxx + rr, cyy + rr), fill=(255, 218, 214))
        d.rounded_rectangle((cxx - 70 * k, cyy - 14 * k, cxx + 70 * k, cyy + 14 * k), radius=14 * k, fill=(186, 26, 26))

    return base.resize((S, S), Image.LANCZOS)


def square(img, size):
    return img.resize((size, size), Image.LANCZOS)


def sidebar(icon):
    w, h = 164, 314
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (y / (h - 1)) * 0.85 + (x / (w - 1)) * 0.15
            px[x, y] = lerp((52, 36, 98), PRIMARY_LIGHT, t)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((-70, h - 120, 130, h + 80), fill=(255, 255, 255, 28))
    d.ellipse((60, h - 60, 230, h + 110), fill=(255, 216, 228, 40))
    ic = square(icon, 96)
    img.paste(ic, ((w - 96) // 2, 36), ic)
    return img


def header(icon):
    w, h = 150, 57
    img = Image.new("RGB", (w, h), (254, 247, 255))
    ic = square(icon, 40)
    img.paste(ic, (w - 48, 8), ic)
    return img


def main():
    app = draw_icon(False)
    unin = draw_icon(True)
    app.save(OUT / "icon.png")
    square(app, 32).save(OUT / "32x32.png")
    square(app, 128).save(OUT / "128x128.png")
    square(app, 256).save(OUT / "128x128@2x.png")
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    app.save(OUT / "icon.ico", sizes=sizes)
    app.save(OUT / "installer.ico", sizes=sizes)
    unin.save(OUT / "uninstaller.ico", sizes=sizes)
    app.save(OUT / "icon.icns")
    sidebar(app).save(OUT / "nsis-sidebar.bmp")
    header(app).save(OUT / "nsis-header.bmp")
    print("Icons written to", OUT)


if __name__ == "__main__":
    main()
