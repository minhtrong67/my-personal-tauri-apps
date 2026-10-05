<div align="center">

<img src="src/assets/logo.svg" alt="Material Note logo" width="120" height="120">

# Material Note

**A fast, tabbed notepad with Material Design 3 — built with Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Overview

Material Note is a lightweight desktop notepad in the spirit of Windows Notepad, redesigned around
Google's **Material Design 3**. It starts instantly, keeps memory use low (Tauri + system WebView),
and stays out of your way while you write.

## Features

| Area | What you get |
| --- | --- |
| **Documents** | Tabs, New / Open (multi-select) / Save / Save as, unsaved-changes prompt, drag & drop files, reopen files on startup, open from the command line or "Open with" |
| **Editing** | Undo / redo, cut / copy / paste, select all, delete, insert time & date (`F5`), go to line, CRLF ⇄ LF switch |
| **Find & replace** | Next / previous, replace, replace all, match case, whole word (Unicode aware), regular expressions, live match counter |
| **View** | Vertical or horizontal tabs, zoom (`Ctrl` + `+` / `-` / `0` / mouse wheel), word wrap, status bar (line, column, characters, zoom, encoding, line ending), full screen |
| **Appearance** | Light / dark / follow system, **custom theme color** (preset swatches + color picker), system UI font, optional monospace or serif editor font, adjustable font size, smooth Material motion (ripples, dialog and menu transitions; respects reduced-motion) |
| **Languages** | English and Tiếng Việt, switchable at runtime; auto-detected on first launch |
| **Printing** | System print dialog (`Ctrl+P`) |
| **Packaging** | Custom app icon, installer icon, uninstaller icon, NSIS and MSI installer artwork — all in the Material 3 style |

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

## How the theme works

Pick any seed color in **Settings → Theme color**. Material Note converts it to OKLCH and derives the
Material 3 color roles (primary, secondary container, surface containers, outline…) for both the
light and dark schemes, so every surface follows your color. The mapping lives in `src/theme.js`
and `src/styles.css`. It approximates the official HCT tonal palettes rather than reproducing them
exactly.

## Project structure

```
material-note/
├── src/                      # Frontend (plain HTML / CSS / JS, no bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Seed color → M3 palette, light/dark/system
│   ├── i18n.js               # English + Vietnamese strings
│   ├── app.js                # Tabs, files, find/replace, menus, settings
│   └── assets/logo.svg
├── src-tauri/                # Rust backend
│   ├── src/main.rs           # File read/write commands
│   ├── tauri.conf.json       # Window, bundle, installer configuration
│   ├── capabilities/         # Tauri permissions
│   └── icons/                # App icons + installer/ (setup & uninstall icons, artwork)
├── tools/generate_icons.py   # Regenerates every icon from code
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
cd material-note

npm install        # once: installs the Tauri CLI
npm run dev        # run in development
npm run build      # build installers
```

The project is a member of the parent Cargo workspace (`members = ["*/src-tauri"]`), so it shares
the workspace `target/` build cache. Build output is in `<workspace>/target/release/bundle/`.
If you use it on its own, add an empty `[workspace]` table to `src-tauri/Cargo.toml`.

### Installer output

| Format | Location | Notes |
| --- | --- | --- |
| NSIS `.exe` | `target/release/bundle/nsis/` | Per-user install, custom header & sidebar artwork |
| MSI `.msi` | `target/release/bundle/msi/` | Custom banner & dialog artwork (build on Windows) |

> **About the uninstaller icon.** `icons/installer/uninstall.ico` is included, but Tauri's NSIS
> template currently applies the single `installerIcon` to both the setup and the uninstaller.
> Swap the path in `tauri.conf.json` if you prefer the uninstall variant there.

## Customizing

- **Brand color / icons:** edit the palette at the top of `tools/generate_icons.py`, run it, rebuild.
- **Default theme color:** change `DEFAULTS.seed` in `src/app.js` and the `--h` / `--c` fallbacks in `src/styles.css`.
- **More languages:** add a dictionary to `src/i18n.js` and a radio option in `src/index.html`.

## Limitations

- Files are read and written as UTF-8 (a BOM is dropped; invalid bytes are replaced).
- Undo history is per tab and is cleared when the tab is closed.
- The default window is tested through Tauri 2's WebView; colors use `oklch()` and `color-mix()`,
  which need a reasonably current WebView2 / WebKit.

## Credits

Created by **minhtrong67**, with the support of **Claude**, an AI assistant by [Anthropic](https://www.anthropic.com).

## License

Released under the [MIT License](LICENSE).
