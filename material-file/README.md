<div align="center">

<img src="src/assets/logo.svg" alt="Material File logo" width="120" height="120">

# Material File

**A simple, fast file manager inspired by Windows 11 File Explorer, designed with Material Design 3 — built with Tauri.**

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

Material File keeps the parts of File Explorer people use every day — quick access, drives, folder tabs, breadcrumbs, details and icon views, copy / cut / paste, rename, recycle bin, search and a details pane — and drops the rest. It starts quickly, uses little memory (Tauri + the system WebView) and follows Google's **Material Design 3**.

## Screenshots

<p align="center">
  <img src="screenshots/image01.png" alt="Material File - light theme" width="49%">
  <img src="screenshots/image02.png" alt="Material File - dark theme" width="49%">
</p>
<p align="center">
  <img src="screenshots/image03.png" alt="Material File - icon view and details pane" width="49%">
  <img src="screenshots/image04.png" alt="Material File - context menu and settings" width="49%">
</p>

## Features

| Area | What you get |
| --- | --- |
| **Navigation** | A **Home page** like Windows 11 (quick access cards, frequent folders, recent files, drives), back / forward / up / refresh (right-click back / forward for the **history list**; **mouse side buttons** (Back / Forward) work, also with gaming mice), editable breadcrumb address bar (click `›` to jump into any sub-folder), a **folder tree** in the sidebar (opens only when you click its arrows; an optional setting expands it to the current folder), pinned folders, *This PC* with drive usage bars, Recycle Bin shortcut, **folder tabs** (`Ctrl+T`, middle-click a folder) |
| **Views** | Details view with **resizable, selectable columns** (name, date modified, date created, type, size), small / medium / large icon views with image thumbnails, **Group by** (name, type, date modified, size), a **type filter**, optional **item check boxes**, optional **details pane** (preview for images and text, `Alt+P`), show / hide hidden items and file extensions |
| **File operations** | New folder / text / Markdown / JSON / HTML / CSV, cut, copy, paste with a **Replace / Skip / Keep both** conflict dialog, inline rename (`F2`) and **batch rename** of several items, delete to the Recycle Bin or permanently, **undo** (`Ctrl+Z`), drag & drop to move (hold `Ctrl` to copy), rubber-band selection, and a **progress card with Cancel** for long copy / move operations |
| **Context menu** | Windows-style menus for items, folders, the sidebar and empty space: *Open*, *Open in new tab*, **Open in Terminal**, **Open with Code**, *Open with* (Notepad, WinRAR), *Show in File Explorer*, *Pin to Quick access*, **Copy as path**, cut / copy / rename / delete, *Properties*, *Set as desktop background* for images, *Open in new window*, plus View / Sort by / New sub-menus |
| **Archives** | **Extract here / Extract to folder** and **Compress to ZIP / RAR** using **WinRAR** when installed (falls back to 7-Zip, then PowerShell / `tar` for ZIP) |
| **Paths** | Long paths never overflow: the address bar keeps the deepest folders visible, dialogs wrap them, and there are **copy-path buttons** in the address bar and the Properties dialog |
| **Search** | Instant filter while typing; press `Enter` to search the current folder and all sub-folders |
| **Window** | **Window options** in Settings: *remember window size* (reopens at the size you last resized to) or *always open maximized*; `F11` toggles full screen; extra windows with `Ctrl+N` |
| **Appearance** | Light / dark / follow system, **custom theme color** (preset swatches + color picker), system UI font, Material motion (ripples, dialog and menu transitions; respects reduced-motion) |
| **Languages** | English and Tiếng Việt, switchable at runtime; auto-detected on first launch |
| **Packaging** | Custom app, installer and uninstaller icons plus NSIS / MSI artwork, all in the Material 3 style |

### Keyboard shortcuts

| Action | Shortcut | Action | Shortcut |
| --- | --- | --- | --- |
| Open | `Enter` | Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` |
| Back / Forward / Up | `Backspace` / `Alt+←` / `Alt+→` / `Alt+↑`, mouse side buttons | Copy as path | `Ctrl+Shift+C` |
| Address bar | `Ctrl+L` / `Alt+D` | Undo | `Ctrl+Z` |
| Search | `Ctrl+F` | Rename | `F2` |
| New tab / Close tab / Next tab | `Ctrl+T` / `Ctrl+W` / `Ctrl+Tab` | Delete / permanent delete | `Del` / `Shift+Del` |
| New folder | `Ctrl+Shift+N` | Properties | `Alt+Enter` |
| Details / Icons view | `Ctrl+1` / `Ctrl+2` | Details pane | `Alt+P` |
| Refresh | `F5` | Full screen | `F11` |
| New window | `Ctrl+N` | Batch rename (several items selected) | `F2` |
| Settings | `Ctrl+,` | Clear search or selection | `Esc` |

## Download

Get the latest Windows installer (`Material File_x.y.z_x64-setup.exe`) from the **[Releases](https://github.com/minhtrong67/material-file/releases/latest)** page.

## Installation

1. Download and run the installer — it installs for the current user, no administrator rights needed.
2. Start **Material File** from the Start menu.
3. Optional: install [WinRAR](https://www.win-rar.com) for RAR / 7z / ZIP extraction and compression, and [VS Code](https://code.visualstudio.com) (with `code` in `PATH`) for **Open with Code**.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Tauri 2](https://tauri.app) |
| Backend | Rust — [`trash`](https://crates.io/crates/trash), [`sysinfo`](https://crates.io/crates/sysinfo), [`open`](https://crates.io/crates/open), [`dirs`](https://crates.io/crates/dirs) |
| Frontend | Plain HTML / CSS / JavaScript (no bundler) |
| Design | Material Design 3 (OKLCH-based tonal palettes generated from a seed color) |
| Tooling | npm (Tauri CLI), Python + Pillow (icon generator) |

## Development

Requirements:

- [Rust](https://rustup.rs) 1.77+
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (on Windows: Microsoft C++ Build Tools and WebView2)
- [Node.js](https://nodejs.org) (npm)

```bash
cd material-file

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
material-file/
├── screenshots/              # image01.png, image02.png, ... used by this README
├── src/                      # Frontend (plain HTML / CSS / JS, no bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Seed color → M3 palette, light/dark/system
│   ├── boot.js               # Applies the saved theme before first paint
│   ├── i18n.js               # English + Vietnamese strings
│   ├── app.js                # Navigation, tabs, listing, selection, menus, file operations
│   └── assets/logo.svg
├── src-tauri/                # Rust backend
│   ├── src/main.rs           # list / search / copy / move / rename / trash / drives / archives / tools commands
│   ├── tauri.conf.json       # Window, bundle, installer configuration
│   ├── capabilities/         # Tauri permissions
│   └── icons/                # App icons + installer/ (setup & uninstall icons, artwork)
├── tools/generate_icons.py   # Regenerates every icon from code
├── package.json
├── LICENSE
└── README.md
```

### Limitations

- Cut / copy / paste works inside the app; it does not exchange files with the system clipboard or other applications.
- Pasting asks what to do with name conflicts (replace, skip or keep both as `file (2).txt`).
- Undo covers rename, new items, copy / paste, move and compress — not deletion (use the Recycle Bin to restore).
- *Replace* in the conflict dialog deletes the existing item permanently (it does not go to the Recycle Bin).
- Colors use `oklch()` and `color-mix()`, which need a reasonably current WebView2 / WebKit.

## Credits

Created by **minhtrong67** with the support of the AI assistant **Claude** ([Anthropic](https://www.anthropic.com)).

## License

Released under the [MIT License](LICENSE).
