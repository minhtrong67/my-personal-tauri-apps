# Screenshot Beautifier

A fast, lightweight desktop application that turns plain screenshots into polished images for documentation, blog posts, social media and presentations. It follows the Windows 11 Fluent 2 design language (WinUI style: layered surfaces, Segoe UI Variable, 4px controls and 8px containers) and lets you pick any accent color.

Author: **minhtrong67**
Built with the assistance of **Claude** (Anthropic).

## Features

**Get an image in**
- Paste with `Ctrl` + `V` (press `Win` + `Shift` + `S` to capture, then paste here)
- Drag and drop an image file, or open one with the file dialog (PNG, JPEG, WebP, GIF, BMP)
- A built in sample image to try every option

**Background**
- Gradient with angle, two or three colors and 14 presets
- Solid color, your own background image with adjustable blur, or fully transparent

**Layout**
- Padding, corner radius and aspect ratio presets (1:1, 4:3, 3:2, 16:9, 9:16, 4:5, 2:1) or a custom ratio
- Soft drop shadow with blur, opacity, vertical offset and color
- Optional border with color and opacity
- Seven one click styles: Clean, Ocean, Sunset, Night, Aurora, Glass and Flat

**Window frame**
- Windows 11 title bar, macOS traffic lights, browser address bar (with editable address) or a frosted glass border
- Light and dark frame themes and an editable frame title

**Edit**
- Crop by dragging a selection, with reset
- Annotations: box, arrow, text, highlight and pixelate (to hide sensitive data)
- Text caption above or below the image
- Unlimited undo and redo for crops and annotations

**Export**
- PNG, JPEG or WebP with quality control, at 1x, 2x or 3x
- Copy the result straight to the clipboard, or save with a native dialog
- Large images are protected: the export scale is reduced automatically beyond 8192 px

**Fluent 2 experience**
- Light, dark and system themes
- Customizable accent color: 20 Windows style presets or any custom color. Contrast is adjusted automatically so text stays readable in light and dark themes
- Vietnamese and English interface, defaulting to your system language
- Responsive layout and a custom Fluent style title bar
- Your style settings and preferences are remembered

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `V` | Paste an image |
| `Ctrl` + `O` | Open an image |
| `Ctrl` + `S` | Save the result |
| `Ctrl` + `Shift` + `C` | Copy the result to the clipboard |
| `Ctrl` + `Z` / `Ctrl` + `Y` | Undo or redo |
| `Enter` / `Esc` | Apply or cancel a crop |

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

## Project structure

```
screenshot-beautifier/
  src/                  Frontend: index.html (canvas editor and Fluent UI)
  src-tauri/
    src/lib.rs          Rust core: read an image, native save dialog
    src/main.rs         Entry point
    tauri.conf.json     Window and bundle settings
    capabilities/       Permissions granted to the main window
    icons/              Application icons (Fluent 2 style)
  package.json
```

## Technology

- [Tauri 2](https://tauri.app) with a small Rust core and the WebView2 runtime that ships with Windows, so no browser engine is bundled and the installer stays small
- Vanilla HTML, CSS and JavaScript with the Canvas 2D API, no runtime framework and no network access needed
- Segoe UI Variable and Segoe Fluent Icons, which ship with Windows 11

## Window frame

The window uses a custom Fluent style title bar (`decorations` is `false` in `src-tauri/tauri.conf.json`). Set it to `true` to use the native Windows title bar instead; the custom bar then hides itself automatically.

## Changing the app icon

Icons are embedded at compile time. After replacing files in `src-tauri/icons/`, run `cargo clean -p screenshot-beautifier` and build again.

## Roadmap

- Screen capture inside the app
- Draggable and resizable annotations
- Mesh gradients and noise textures
- Saving and sharing your own styles
- Batch processing of many screenshots

## Credits

Designed and maintained by **minhtrong67**. Development was supported by Claude, an AI assistant made by Anthropic, which helped with design, implementation and documentation.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
