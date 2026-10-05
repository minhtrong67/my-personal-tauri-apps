# Photo Viewer

A fast, lightweight desktop application to browse, view and edit your pictures on Windows, in the spirit of the Microsoft Photos app. It follows the Material Design 3 design language (tonal color roles, navigation rail, top app bar, floating toolbar, dialogs and snackbars), uses the system UI font, and lets you pick any theme color.

Author: **minhtrong67**
Built with the assistance of **Claude** (Anthropic).

## Features

**Browse**
- Open a picture or a whole folder, drag and drop, or double click a picture in Windows Explorer (the whole folder is loaded so you can move to the next picture)
- Collection grid with adjustable thumbnail size, search by file name, and sorting by name, date modified or size (ascending or descending)
- Filmstrip of the folder while viewing

**View**
- Smooth zoom with the mouse wheel around the cursor, drag to pan, double click to switch between fit and zoomed, plus fit, zoom in and zoom out buttons
- Previous and next with the arrow keys or on screen buttons, with preloading of neighbors
- Slideshow with a configurable interval, full screen mode and a picture info panel (name, dimensions, size, date, type, location)
- Copy the picture to the clipboard, print, show in folder, and delete to the Recycle Bin with confirmation
- Supports PNG, JPEG, GIF (animated), WebP, BMP, ICO, AVIF and SVG

**Edit**
- Crop with a draggable box and aspect ratios (free, original, 1:1, 4:3, 3:2, 16:9, 9:16), straighten, rotate by 90 degrees and flip
- Adjust brightness, contrast, saturation, warmth, sharpness, vignette and blur with live preview
- Nine filters with thumbnails: Original, Vivid, Warm, Cool, Mono, Noir, Sepia, Fade and Dramatic
- Draw with a pen or highlighter in eight colors and adjustable size
- Unlimited undo and redo, a hold to compare button to see the original, and reset
- Save over the original (with confirmation) or save a copy, as PNG, JPEG or WebP with quality control and an optional 75, 50 or 25 percent size

**Material Design 3 experience**
- Light, dark and system themes
- Customizable theme color: 8 presets or any custom color from the color picker, applied to the whole interface
- Vietnamese and English interface, defaulting to your system language
- Adaptive layout: navigation rail on wide windows, bottom navigation bar on narrow ones
- System UI font, so text looks native on every machine

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `O` | Open a picture |
| `Left` / `Right` | Previous or next picture |
| `+` / `-` / `0` / `1` | Zoom in, zoom out, fit, actual size |
| `E` | Edit the current picture |
| `Delete` | Delete the current picture |
| `I` | Show or hide the info panel |
| `Ctrl` + `C` | Copy the picture |
| `F11` | Full screen |
| `Esc` | Leave full screen, editor or viewer |
| `Ctrl` + `Z` / `Ctrl` + `Y` | Undo or redo (editor) |

## Getting started

Prerequisites on Windows 10 or 11:

- [Node.js](https://nodejs.org) 18 or later
- [Rust](https://rustup.rs) (stable toolchain)
- Microsoft C++ Build Tools (the "Desktop development with C++" workload of Visual Studio Build Tools)
- Microsoft Edge WebView2 Runtime (already included with Windows 11 and current Windows 10)

Keep this project inside your shared Cargo workspace folder (for example `D:\tauri-apps\`) so all Tauri projects reuse one build cache:

```bash
npm install
npm run dev      # run in development
npm run build    # build the Windows installer
```

The installer is written to `<workspace>\target\release\bundle\nsis\`.

## Set Photo Viewer as the default app

The installer registers PNG, JPEG, GIF, WebP, BMP, ICO and AVIF files. Windows does not allow an application to make itself the default, so confirm it once:

1. Right click any picture and choose **Open with**, then **Choose another app**.
2. Select **Photo Viewer**.
3. Tick **Always use this app** and confirm.

## Branding

The application icon, the setup icon, the uninstaller icon and the installer artwork (header and sidebar images) are all drawn in the Material Design 3 style and live in `src-tauri/icons/` and `src-tauri/installer/`. They are wired up in `src-tauri/tauri.conf.json`. Icons are embedded at compile time, so after replacing them run `cargo clean -p photo-viewer` and build again. If Windows shows an old icon after reinstalling, refresh the icon cache with `ie4uinit.exe -ClearIconCache`.

## Project structure

```
photo-viewer/
  src/                  Frontend: index.html (gallery, viewer and editor)
  src-tauri/
    src/lib.rs          Rust core: folder listing, image read and write, Recycle Bin, single instance
    src/main.rs         Entry point
    tauri.conf.json     Window, bundle, installer and file association settings
    capabilities/       Permissions granted to the main window
    icons/              Application, setup and uninstall icons
    installer/          Installer header and sidebar images
  package.json
```

## Technology

- [Tauri 2](https://tauri.app) with a small Rust core and the WebView2 runtime that ships with Windows, so no browser engine is bundled and the installer stays small
- Vanilla HTML, CSS and JavaScript with the Canvas 2D API for editing, no runtime framework
- Thumbnails and the viewer load pictures through Tauri's asset protocol, which is enabled for local files in `tauri.conf.json`; edits are rendered from the original bytes at full resolution

## Roadmap

- Text and shape tools in the editor
- Selective adjustments (highlights, shadows, tint)
- Rename, move and copy files
- Albums and favorites
- Video playback

## Credits

Designed and maintained by **minhtrong67**. Development was supported by Claude, an AI assistant made by Anthropic, which helped with design, implementation and documentation.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
