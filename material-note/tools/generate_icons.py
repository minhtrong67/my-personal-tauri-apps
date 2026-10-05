#!/usr/bin/env python3
"""
Material Note - icon generator (Material Design 3 style)

Generates every raster asset the project needs from code, so the icons stay
reproducible and can be re-themed by editing the palette below.

    pip install pillow
    python tools/generate_icons.py

Outputs
  src-tauri/icons/            app icon set (png, ico, icns)
  src-tauri/icons/installer/  installer.ico, uninstall.ico, NSIS + WiX imagery
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"
INSTALLER = ICONS / "installer"
for d in (ICONS, INSTALLER):
    d.mkdir(parents=True, exist_ok=True)

# --- M3 baseline palette -----------------------------------------------------
PRIMARY = (103, 80, 164)        # #6750A4
PRIMARY_CONTAINER = (234, 221, 255)  # #EADDFF
PRIMARY_FIXED_DIM = (208, 188, 255)  # #D0BCFF
TERTIARY = (125, 82, 96)        # #7D5260
TERTIARY_CONTAINER = (255, 216, 228)  # #FFD8E4
ERROR = (179, 38, 30)           # #B3261E
GRAPHITE = (73, 69, 79)         # #49454F
SURFACE = (254, 247, 255)       # #FEF7FF
WHITE = (255, 255, 255)

DESIGN = 1024  # design grid
K = 3          # supersampling factor


def s(v):
    return int(round(v * K))


def rrect(d, box, r, fill):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((s(x0), s(y0), s(x1), s(y1)), radius=s(r), fill=fill)


def poly(d, pts, fill):
    d.polygon([(s(x), s(y)) for x, y in pts], fill=fill)


def pencil_layer():
    """Pencil drawn horizontally (tip on the left) on its own transparent layer."""
    w, h = 520, 160
    layer = Image.new("RGBA", (s(w), s(h)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rrect(d, (170, 20, 440, 140), 14, TERTIARY)            # body
    rrect(d, (430, 20, 500, 140), 26, TERTIARY_CONTAINER)  # eraser
    rrect(d, (404, 20, 440, 140), 0, PRIMARY_FIXED_DIM)    # ferrule band
    poly(d, [(170, 20), (170, 140), (40, 80)], TERTIARY_CONTAINER)  # wood
    poly(d, [(78, 62), (78, 98), (40, 80)], GRAPHITE)      # lead
    return layer


def badge(img, kind, cx, cy, r):
    d = ImageDraw.Draw(img)
    ring = r + 22
    d.ellipse((s(cx - ring), s(cy - ring), s(cx + ring), s(cy + ring)), fill=PRIMARY)
    color = TERTIARY if kind == "install" else ERROR
    d.ellipse((s(cx - r), s(cy - r), s(cx + r), s(cy + r)), fill=color)
    w = 26
    if kind == "install":  # arrow down + tray
        rrect(d, (cx - w / 2, cy - 78, cx + w / 2, cy + 20), 12, WHITE)
        poly(d, [(cx - 58, cy - 6), (cx + 58, cy - 6), (cx, cy + 62)], WHITE)
        rrect(d, (cx - 66, cy + 72, cx + 66, cy + 72 + w), 12, WHITE)
    else:  # cross
        d.line([(s(cx - 58), s(cy - 58)), (s(cx + 58), s(cy + 58))], fill=WHITE, width=s(w), joint="curve")
        d.line([(s(cx + 58), s(cy - 58)), (s(cx - 58), s(cy + 58))], fill=WHITE, width=s(w), joint="curve")
        for px, py in ((-58, -58), (58, 58), (58, -58), (-58, 58)):
            d.ellipse((s(cx + px - w / 2), s(cy + py - w / 2), s(cx + px + w / 2), s(cy + py + w / 2)), fill=WHITE)


def render(variant="app"):
    img = Image.new("RGBA", (s(DESIGN), s(DESIGN)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # container
    rrect(d, (64, 64, 960, 960), 232, PRIMARY)

    # sheet with a folded corner
    rrect(d, (276, 212, 748, 812), 44, PRIMARY_CONTAINER)
    poly(d, [(604, 196), (764, 196), (764, 356)], PRIMARY)          # cut corner
    poly(d, [(604, 212), (604, 356), (748, 356)], PRIMARY_FIXED_DIM)  # fold

    # ruled lines
    for i, width in enumerate((304, 304, 304, 170)):
        y = 440 + i * 84
        rrect(d, (352, y, 352 + width, y + 36), 18, PRIMARY)

    if variant == "app":
        pen = pencil_layer()
        pen = pen.resize((int(pen.width * 0.85), int(pen.height * 0.85)), Image.LANCZOS)
        pen = pen.rotate(45, resample=Image.BICUBIC, expand=True)
        # outline ring around the pencil so it separates from the sheet
        alpha = pen.split()[3].filter(ImageFilter.MaxFilter(s(28) | 1))
        ring = Image.new("RGBA", pen.size, PRIMARY + (255,))
        ring.putalpha(alpha)
        px, py = s(712) - pen.width // 2, s(730) - pen.height // 2
        img.alpha_composite(ring, (px, py))
        img.alpha_composite(pen, (px, py))
    else:
        badge(img, variant, 744, 744, 138)

    return img.resize((DESIGN, DESIGN), Image.LANCZOS)


def save_png_set(master, folder):
    sizes = {"32x32.png": 32, "64x64.png": 64, "128x128.png": 128,
             "128x128@2x.png": 256, "icon.png": 512}
    for name, px in sizes.items():
        master.resize((px, px), Image.LANCZOS).save(folder / name)
    # Windows Store / MSIX logos (optional but harmless)
    for px in (30, 44, 71, 89, 107, 142, 150, 284, 310):
        master.resize((px, px), Image.LANCZOS).save(folder / f"Square{px}x{px}Logo.png")
    master.resize((50, 50), Image.LANCZOS).save(folder / "StoreLogo.png")


ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# --- app icon set -------------------------------------------------------------
app = render("app")
save_png_set(app, ICONS)
app.save(ICONS / "icon.ico", sizes=ICO_SIZES)
app.save(ICONS / "icon.icns")

# --- installer / uninstaller icons -------------------------------------------
render("install").save(INSTALLER / "installer.ico", sizes=ICO_SIZES)
render("uninstall").save(INSTALLER / "uninstall.ico", sizes=ICO_SIZES)
render("install").resize((256, 256), Image.LANCZOS).save(INSTALLER / "installer.png")
render("uninstall").resize((256, 256), Image.LANCZOS).save(INSTALLER / "uninstall.png")


def flat(img, bg):
    base = Image.new("RGB", img.size, bg)
    base.paste(img, mask=img.split()[3])
    return base


def vertical_gradient(size, top, bottom):
    w, h = size
    g = Image.new("RGB", size)
    gd = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1)
        gd.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g


# NSIS header (150x57) and sidebar (164x314)
header = Image.new("RGB", (150, 57), SURFACE)
header.paste(app.resize((44, 44), Image.LANCZOS), (98, 6), app.resize((44, 44), Image.LANCZOS))
header.save(INSTALLER / "nsis-header.bmp")

side = vertical_gradient((164, 314), PRIMARY_CONTAINER, PRIMARY_FIXED_DIM)
sd = ImageDraw.Draw(side)
sd.ellipse((-60, 200, 120, 380), fill=PRIMARY_FIXED_DIM)
sd.ellipse((60, 230, 240, 410), fill=(196, 172, 250))
logo = app.resize((96, 96), Image.LANCZOS)
side.paste(logo, (34, 40), logo)
side.save(INSTALLER / "nsis-sidebar.bmp")

# WiX (MSI) banner 493x58 and dialog 493x312
banner = Image.new("RGB", (493, 58), SURFACE)
b_logo = app.resize((44, 44), Image.LANCZOS)
banner.paste(b_logo, (440, 7), b_logo)
banner.save(INSTALLER / "wix-banner.bmp")

dialog = Image.new("RGB", (493, 312), WHITE)
left = vertical_gradient((164, 312), PRIMARY_CONTAINER, PRIMARY_FIXED_DIM)
dialog.paste(left, (0, 0))
dd = ImageDraw.Draw(dialog)
dd.ellipse((-60, 200, 120, 380), fill=PRIMARY_FIXED_DIM)
d_logo = app.resize((96, 96), Image.LANCZOS)
dialog.paste(d_logo, (34, 40), d_logo)
dialog.save(INSTALLER / "wix-dialog.bmp")

print("Icons generated in", ICONS)
