<div align="center">

<img src="src/assets/logo.svg" alt="Material File logo" width="120" height="120">

# Material File

**A simple, fast file manager inspired by Windows 11 File Explorer, designed with Material Design 3 — built with Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Overview

Material File keeps the parts of File Explorer people use every day — quick access, drives,
breadcrumbs, details and icon views, copy / cut / paste, rename, recycle bin and search — and drops
the rest. It starts quickly, uses little memory (Tauri + the system WebView) and follows Google's
**Material Design 3**.

## Features

| Area | What you get |
| --- | --- |
| **Navigation** | Back / forward / up / refresh, editable breadcrumb address bar, quick access (Home, Desktop, Documents, Downloads, Pictures, Music, Videos), *This PC* with drive usage bars |
| **Views** | Details view with sortable columns (name, date modified, type, size) and an icon view with image thumbnails; folders are always listed first |
| **File operations** | New folder / text document, cut, copy, paste, inline rename (`F2`), delete to the Recycle Bin or permanently (`Shift+Delete`), drag & drop to move (hold `Ctrl` to copy), automatic unique names on conflicts |
| **Selection** | Click, `Ctrl`/`Shift` multi-select, `Ctrl+A`, full keyboard navigation and type-ahead |
| **Search** | Instant filter while typing; press `Enter` to search the current folder and all sub-folders |
| **Details** | Properties dialog (size, contents, dates, attributes) for one or many items; status bar with item count and selection size |
| **Appearance** | Light / dark / follow system, **custom theme color** (preset swatches + color picker), system UI font, Material motion (ripples, dialog and menu transitions; respects reduced-motion) |
| **Languages** | English and Tiếng Việt, switchable at runtime; auto-detected on first launch |
| **Packaging** | Custom app, installer and uninstaller icons plus NSIS / MSI artwork, all in the Material 3 style |

### Keyboard shortcuts

| Action | Shortcut | Action | Shortcut |
| --- | --- | --- | --- |
| Open | `Enter` | Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` |
| Back / Forward / Up | `Backspace` or `Alt+←` / `Alt+→` / `Alt+↑` | Select all | `Ctrl+A` |
| Address bar | `Ctrl+L` or `Alt+D` | New folder | `Ctrl+Shift+N` |
| Search | `Ctrl+F` | Rename | `F2` |
| Refresh | `F5` | Delete / permanent delete | `Del` / `Shift+Del` |
| Details / Icons view | `Ctrl+1` / `Ctrl+2` | Properties | `Alt+Enter` |
| Settings | `Ctrl+,` | Clear search or selection | `Esc` |

## Project structure

```
material-file/
├── src/                      # Frontend (plain HTML / CSS / JS, no bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Seed color → M3 palette, light/dark/system
│   ├── boot.js               # Applies the saved theme before first paint
│   ├── i18n.js               # English + Vietnamese strings
│   ├── app.js                # Navigation, listing, selection, file operations
│   └── assets/logo.svg
├── src-tauri/                # Rust backend
│   ├── src/main.rs           # list / search / copy / move / rename / trash / drives commands
│   ├── tauri.conf.json       # Window, bundle, installer configuration
│   ├── capabilities/         # Tauri permissions
│   └── icons/                # App icons + installer/ (setup & uninstall icons, artwork)
├── tools/generate_icons.py   # Regenerates every icon from code
├── package.json
├── LICENSE
└── README.md
```

## Requirements

- [Rust](https://rustup.rs) 1.77 or newer
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
  (on Windows: Microsoft C++ Build Tools and WebView2, which ships with Windows 10/11)
- [Node.js](https://nodejs.org) (npm) — installs the Tauri CLI from `package.json`
- Optional, to regenerate icons: Python 3 and `pip install pillow`

## Getting started

```bash
cd material-file

npm install        # once: installs the Tauri CLI
npm run dev        # run in development
npm run build      # build installers
```

The project is designed to live in a Cargo workspace (`members = ["*/src-tauri"]`) and share its
`target/` build cache. Build output is in `<workspace>/target/release/bundle/`. To use it on its
own, add an empty `[workspace]` table to `src-tauri/Cargo.toml`.

> **About the uninstaller icon.** `icons/installer/uninstall.ico` is included, but Tauri's NSIS
> template applies the single `installerIcon` to both the setup and the uninstaller.

## How it works

The frontend is plain JavaScript. All file-system work happens in Rust commands:
`list_dir`, `search_dir`, `paste_items`, `rename_item`, `create_item`, `delete_items`
(via the [`trash`](https://crates.io/crates/trash) crate), `item_properties`, `get_drives`
(via [`sysinfo`](https://crates.io/crates/sysinfo)) and `open_item` (via
[`open`](https://crates.io/crates/open)). Image thumbnails use Tauri's asset protocol.

## Limitations

- Cut / copy / paste works inside the app; it does not exchange files with the system clipboard
  or with other applications.
- Pasting never overwrites: name conflicts get a unique name such as `file (2).txt`.
- Folder lists are rendered without virtualization (with `content-visibility` to keep large
  folders smooth); extremely large folders may take a moment to load.
- Colors use `oklch()` and `color-mix()`, which need a reasonably current WebView2 / WebKit.

## Credits

Created by **minhtrong67**, with the support of **Claude**, an AI assistant by [Anthropic](https://www.anthropic.com).

## License

Released under the [MIT License](LICENSE).
