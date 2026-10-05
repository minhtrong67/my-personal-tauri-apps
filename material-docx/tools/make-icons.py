#!/usr/bin/env python3
"""Generate every Material Docx icon (Material Design 3 style) with Pillow.

Outputs into src-tauri/icons:
  32x32.png, 128x128.png, 128x128@2x.png, icon.png, icon.ico, icon.icns
  installer.ico, uninstaller.ico
  nsis-sidebar.bmp, nsis-header.bmp
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

S = 1024  # master canvas
SS = 2    # supersampling factor for smooth edges

# Material 3 baseline-ish tones
PRIMARY = (103, 80, 164)
PRIMARY_LIGHT = (134, 108, 200)
PRIMARY_CONT = (234, 221, 255)
TERTIARY_CONT = (255, 216, 228)
TERTIARY = (125, 82, 96)
PAPER = (255, 255, 255)
SHADOW = (40, 20, 80)
GREY_A = (96, 92, 108)
GREY_B = (136, 132, 148)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(c1, c2, t)
    return img


def draw_icon(uninstall=False):
    n = S * SS
    k = SS
    c1, c2 = (GREY_A, GREY_B) if uninstall else (PRIMARY, PRIMARY_LIGHT)
    # base squircle-ish rounded square
    bg = gradient(n, c1, c2).convert("RGBA")
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, n - 1, n - 1), radius=int(0.225 * n), fill=255)
    base = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    base.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(base)

    # soft page shadow
    sh = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    px0, py0, px1, py1 = 262 * k, 170 * k, 762 * k, 850 * k
    fold = 150 * k
    sd.polygon(
        [(px0, py0 + 24 * k), (px1 - fold, py0 + 24 * k), (px1, py0 + fold + 24 * k), (px1, py1 + 24 * k), (px0, py1 + 24 * k)],
        fill=SHADOW + (90,),
    )
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(22 * k))
    base.alpha_composite(sh)
    d = ImageDraw.Draw(base)

    # page with folded corner
    d.polygon(
        [(px0, py0), (px1 - fold, py0), (px1, py0 + fold), (px1, py1), (px0, py1)],
        fill=PAPER,
    )
    # fold triangle
    d.polygon(
        [(px1 - fold, py0), (px1, py0 + fold), (px1 - fold, py0 + fold)],
        fill=(PRIMARY_CONT if not uninstall else (225, 222, 232)),
    )

    # text lines
    line = PRIMARY_CONT if not uninstall else (210, 207, 220)
    lx0 = px0 + 70 * k
    for i, w in enumerate([330, 330, 330, 210]):
        y = (py0 + 270 + i * 88) * k
        d.rounded_rectangle((lx0, y, lx0 + w * k, y + 38 * k), radius=19 * k, fill=line)
    # heading bar in primary
    d.rounded_rectangle(
        (lx0, (py0 + 150) * k, lx0 + 200 * k, (py0 + 150 + 52) * k),
        radius=26 * k,
        fill=(PRIMARY if not uninstall else GREY_A),
    )

    # badge with pencil (install) or minus (uninstall)
    cx, cy, r = 742 * k, 760 * k, 150 * k
    d.ellipse((cx - r - 14 * k, cy - r - 14 * k, cx + r + 14 * k, cy + r + 14 * k), fill=(PRIMARY if not uninstall else GREY_A))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=TERTIARY_CONT if not uninstall else (255, 218, 214))
    if uninstall:
        d.rounded_rectangle((cx - 70 * k, cy - 14 * k, cx + 70 * k, cy + 14 * k), radius=14 * k, fill=(186, 26, 26))
    else:
        # pencil drawn upright then rotated
        pen = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pen)
        w2 = 34 * k
        top, bot = cy - 105 * k, cy + 55 * k
        pd.rounded_rectangle((cx - w2, top, cx + w2, bot), radius=10 * k, fill=TERTIARY)
        pd.polygon([(cx - w2, bot), (cx + w2, bot), (cx, bot + 62 * k)], fill=(255, 255, 255))
        pd.polygon([(cx - 13 * k, bot + 26 * k), (cx + 13 * k, bot + 26 * k), (cx, bot + 62 * k)], fill=TERTIARY)
        pd.rectangle((cx - w2, top + 30 * k, cx + w2, top + 44 * k), fill=TERTIARY_CONT)
        pen = pen.rotate(-40, center=(cx, cy), resample=Image.BICUBIC)
        base.alpha_composite(pen)

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
