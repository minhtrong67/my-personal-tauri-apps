"""Regenerates every icon asset from the SVG sources in this folder.

    pip install cairosvg pillow
    python design/gen_icons.py
    npx tauri icon design/app-icon.png     # app icons for all platforms

Output: design/*.png, src-tauri/icons/{setup,uninstall}.ico, src-tauri/installer/*.bmp
"""
import io, pathlib
import cairosvg
from PIL import Image, ImageDraw

here = pathlib.Path(__file__).parent
root = here.parent
icons = root / "src-tauri" / "icons"
installer = root / "src-tauri" / "installer"
icons.mkdir(parents=True, exist_ok=True); installer.mkdir(parents=True, exist_ok=True)
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

def render(svg_name, size):
    png = cairosvg.svg2png(url=str(here / svg_name), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")

render("app-icon.svg", 1024).save(here / "app-icon.png")
render("setup-icon.svg", 512).save(here / "setup-icon.png")
render("uninstall-icon.svg", 512).save(here / "uninstall-icon.png")
render("setup-icon.svg", 256).save(icons / "setup.ico", sizes=ICO_SIZES)
render("uninstall-icon.svg", 256).save(icons / "uninstall.ico", sizes=ICO_SIZES)

def gradient(w, h, top=(110, 168, 255), bottom=(11, 87, 208)):
    img = Image.new("RGB", (w, h)); px = img.load()
    for y in range(h):
        k = y / max(h - 1, 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3))
        for x in range(w): px[x, y] = c
    return img

# NSIS wizard images (header 150x57, sidebar 164x314) - BMP as required by NSIS
hdr = gradient(150, 57)
logo = render("app-icon.svg", 48).convert("RGBA"); hdr.paste(logo, (98, 4), logo); hdr.save(installer / "header.bmp")
side = gradient(164, 314)
big = render("app-icon.svg", 128).convert("RGBA"); side.paste(big, (18, 44), big)
d = ImageDraw.Draw(side); d.rounded_rectangle((18, 250, 146, 254), 2, fill=(255, 255, 255)); side.save(installer / "sidebar.bmp")
print("icons ok")
