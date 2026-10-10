<div align="center">

<img src="src/assets/logo.svg" alt="Material Note logo" width="120" height="120">

# Material Note

**A fast, tabbed notepad with Material Design 3 — built with Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)
![Author](https://img.shields.io/badge/Author-minhtrong67-6750A4)
![AI](https://img.shields.io/badge/AI-Claude-D97757)

</div>

---

## Introduction

Material Note is a lightweight desktop notepad in the spirit of Windows Notepad, redesigned around Google's **Material Design 3**. It starts instantly, keeps memory use low (Tauri + the system WebView) and stays out of your way while you write.

## Screenshots

<p align="center">
  <img src="screenshots/image01.png" alt="Material Note - light theme" width="49%">
  <img src="screenshots/image02.png" alt="Material Note - dark theme" width="49%">
</p>
<p align="center">
  <img src="screenshots/image03.png" alt="Material Note - find and replace" width="49%">
  <img src="screenshots/image04.png" alt="Material Note - settings" width="49%">
</p>

## Features

| Area | What you get |
| --- | --- |
| **Documents** | Tabs (horizontal or vertical), New / Open (multi-select) / Save / Save as, unsaved-changes prompt per tab and on exit, drag & drop files, reopen files on startup, open from the command line or “Open with”, Print |
| **Editing** | Undo / redo, cut / copy / paste, go to line, insert time & date (`F5`), CRLF ⇄ LF switch, optional spell check |
| **Find & replace** | Next / previous, replace, replace all, match case, whole word (Unicode aware), regular expressions, **all matches highlighted**, live “3 / 12” counter |
| **View** | Zoom (`Ctrl` + wheel / `+` / `-` / `0`), word wrap, status bar (line, column, characters, zoom, encoding, line ending), system / monospace / serif font and adjustable size, full screen (`F11`) |
| **Window** | **Window options** in Settings: *remember window size* (reopens at the size you last resized to) or *always open maximized* |
| **Appearance** | Light / dark / follow system, **custom theme color** (preset swatches + color picker), system UI font, Material motion (ripples, dialog and menu transitions; respects reduced-motion) |
| **Languages** | English and Tiếng Việt, switchable at runtime; auto-detected on first launch |
| **Packaging** | Custom app, installer and **uninstaller** icons plus NSIS / MSI artwork, all in the Material 3 style |

### Keyboard shortcuts

| Action | Shortcut | Action | Shortcut |
| --- | --- | --- | --- |
| New tab | `Ctrl+N` | Find | `Ctrl+F` |
| Open | `Ctrl+O` | Replace | `Ctrl+H` |
| Save | `Ctrl+S` | Find next / previous | `F3` / `Shift+F3` |
| Save as | `Ctrl+Shift+S` | Go to line | `Ctrl+G` |
| Close tab | `Ctrl+W` | Time / date | `F5` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` | Settings | `Ctrl+,` |
| Print | `Ctrl+P` | Full screen | `F11` |

## Download

Get the latest Windows installer (`Material Note_x.y.z_x64-setup.exe`) from the **[Releases](https://github.com/minhtrong67/material-note/releases/latest)** page.

## Installation

1. Download and run the installer — it installs for the current user, no administrator rights needed.
2. Start **Material Note** from the Start menu.
3. To uninstall, use *Settings → Apps* (or run the uninstaller from the install folder).

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Tauri 2](https://tauri.app) |
| Backend | Rust — [`tauri-plugin-dialog`](https://crates.io/crates/tauri-plugin-dialog) |
| Frontend | Plain HTML / CSS / JavaScript (no bundler) |
| Design | Material Design 3 (OKLCH-based tonal palettes generated from a seed color) |
| Tooling | npm (Tauri CLI), Python + Pillow (icon generator) |

## Development

Requirements:

- [Rust](https://rustup.rs) 1.77+
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (on Windows: Microsoft C++ Build Tools and WebView2)
- [Node.js](https://nodejs.org) (npm)

```bash
cd material-note

npm install        # once: installs the Tauri CLI
npm run dev        # run in development
```

The project is designed to live in a Cargo workspace (`members = ["*/src-tauri"]`) and share its `target/` build cache. To use it on its own, add an empty `[workspace]` table to `src-tauri/Cargo.toml`.

To regenerate every icon (app, installer, uninstaller, NSIS / MSI artwork): `pip install pillow` then `python tools/generate_icons.py`.

## Build

```bash
npm run build
```

Installers are written to `<workspace>/target/release/bundle/` (`nsis/` for the `.exe` setup, `msi/` for the `.msi`).

> **Icons.** The app icon, the setup icon and a separate **uninstaller icon** (`uninstallerIcon`, Tauri 2.9+) are all generated in the Material 3 style — standard sizes 16 – 256 px in the `.ico`, plus 32 / 128 / 256 / 512 px PNGs.

## Project structure

```
material-note/
├── screenshots/              # image01.png, image02.png, ... used by this README
├── src/                      # Frontend (plain HTML / CSS / JS, no bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Seed color → M3 palette, light/dark/system
│   ├── boot.js               # Applies the saved theme before first paint
│   ├── i18n.js               # English + Vietnamese strings
│   ├── app.js                # Tabs, files, find/replace, menus, settings
│   └── assets/logo.svg
├── src-tauri/                # Rust backend
│   ├── src/main.rs           # File read/write commands
│   ├── tauri.conf.json       # Window, bundle, installer configuration
│   ├── capabilities/         # Tauri permissions
│   └── icons/                # App icons + installer/ (setup & uninstall icons, artwork)
├── tools/generate_icons.py   # Regenerates every icon from code
├── package.json
├── LICENSE
└── README.md
```

### Limitations

- Files are read and written as UTF-8 (a BOM is dropped; invalid bytes are replaced).
- Undo history is per tab and is cleared when the tab is closed.
- Colors use `oklch()` and `color-mix()`, which need a reasonably current WebView2 / WebKit.

## Credits

Created by **minhtrong67** with the support of the AI assistant **Claude** ([Anthropic](https://www.anthropic.com)).

## License

Released under the [MIT License](LICENSE).
