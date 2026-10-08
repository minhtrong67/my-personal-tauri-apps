<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="112" alt="Material Xlsx logo" />

# Material Xlsx

**A simple, fast and beautiful spreadsheet editor for `.xlsx` files — built with Tauri 2 and Material Design 3.**

English · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-backend-000000?logo=rust)
![Material Design 3](https://img.shields.io/badge/Material%20Design-3-1B6B3A)
![Languages](https://img.shields.io/badge/UI-English%20%7C%20Ti%E1%BA%BFng%20Vi%E1%BB%87t-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Created by **`minhtrong67`** with the support of AI **`Claude`** (Anthropic)

</div>

---

## Introduction

Material Xlsx is a lightweight desktop alternative to Microsoft Excel for everyday work: open, edit and save `.xlsx` workbooks with formulas, formatting, sorting, filtering and multiple sheets — in a clean Google **Material Design 3** interface that follows your system theme and your own accent colour.

The whole spreadsheet engine (formula parser, evaluator, undo history, virtual grid) is written in plain JavaScript and runs inside Tauri's native WebView, so the installer is small and the app starts instantly. Rust handles file access, the system clipboard and window-state persistence.

## Screenshots

| | |
|---|---|
| ![Light theme](screenshot/image01.png) | ![Dark theme](screenshot/image02.png) |
| *Light theme: formulas, number formats, merged title, frozen header* | *Dark theme with a custom colour and formula auto-complete* |
| ![Settings](screenshot/image03.png) | ![Filter](screenshot/image04.png) |
| *Settings in Vietnamese: theme, colour, language, full screen* | *Column filter with search and check-list* |
| ![Menus and find](screenshot/image05.png) | |
| *Data menu and Find & Replace panel* | |

## Features

**Spreadsheet**
- Multiple sheets: add, rename (double-click), duplicate, reorder, colour tabs, delete
- **110+ functions** — math, statistics, logic, text, date/time and lookup (`SUM`, `AVERAGE`, `IF`, `IFS`, `SUMIFS`, `COUNTIFS`, `VLOOKUP`, `XLOOKUP`, `INDEX/MATCH`, `TEXT`, `TEXTJOIN`, `DATE`, `EDATE`, …), cross-sheet references (`'My Sheet'!A1`), whole-column ranges (`A:A`), circular-reference detection and `#N/A`-style errors
- Function auto-complete with the most common functions first; click-to-insert cell references while typing a formula
- Cell formatting: font, size, bold / italic / underline / strike, text & fill colour, borders, alignment, wrap text, merge cells
- Number formats: general, number, thousands, currency (`$`, `₫`, `€`), percent, scientific, dates & times, text and **custom codes**; +/- decimals
- Sort A→Z / Z→A (header row auto-detected), column **filter** with search, **freeze panes**
- Fill handle with series (numbers, dates, `Item 1, Item 2…`) and relative formula copy, `Ctrl+D` / `Ctrl+R`
- Copy / cut / paste (also from and to Excel), paste values only, paste formatting only
- Insert / delete rows and columns with automatic formula and range adjustment
- Unlimited-style **undo / redo**, find & replace (match case, entire cell, all sheets), AutoSum, name box, status-bar statistics (sum, average, count, min, max)
- Smooth zoom 50–200 %, resizable rows / columns (double-click to auto-fit), print
- Virtualised grid — 100 000+ rows stay fluid

**Files**
- Open / save **`.xlsx`** (styles, merges, widths, frozen panes, filters, formulas with cached values), open and import **CSV / TSV**, export the current sheet to CSV
- Recent files, drag & drop a file onto the window, unsaved-changes protection, "Open with" support

**Design & experience**
- Material Design 3: navigation, menus, dialogs, chips, switches, snackbars, ripples; default font is `system-ui`
- **Light / Dark / System** theme + any **custom theme colour** (generated with Material colour utilities)
- Motion: ripple effect, animated menus and dialogs, sliding sheet-tab indicator, circular-reveal theme switch, smooth selection movement, marching-ants copy marquee, flash on paste / fill / sort — can be turned off in Settings (and respects the OS "reduce motion" setting)
- **English and Vietnamese** interface (switch instantly)
- **Remembers window size**, position and maximised state; option to **always start in full screen** (`F11` toggles at any time)
- Full icon set: app icon, installer (setup) icon and uninstaller icon

## Download

Pre-built installers are published on the **[Releases](https://github.com/minhtrong67/material-xlsx/releases)** page.

| Platform | File |
|---|---|
| Windows 10 / 11 | `Material Xlsx_1.0.0_x64-setup.exe` (NSIS installer) or `.msi` |
| macOS | `.dmg` (build on a Mac) |
| Linux | `.deb` / `.AppImage` (build on Linux) |

## Install

1. Download the installer for your platform from Releases.
2. Run it and follow the wizard (Windows needs the Microsoft WebView2 runtime, already included in Windows 10/11).
3. Launch **Material Xlsx** from the Start menu, then open or drag in an `.xlsx` file.

To uninstall use *Settings → Apps* or the **Uninstall Material Xlsx** shortcut.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) + plugins `dialog`, `opener`, `window-state` |
| Rust crates | `serde`, `base64`, `arboard` (clipboard) |
| UI | HTML, CSS and vanilla JavaScript (ES modules, no bundler) |
| Design system | Material Design 3, colour roles by `@material/material-color-utilities` |
| Spreadsheet engine | Custom Pratt parser + evaluator, immutable-cell model with snapshot undo |
| XLSX I/O | [ExcelJS](https://github.com/exceljs/exceljs) |
| Rendering | Canvas gridlines + virtualised DOM cells in four panes (freeze support) |

## Development

Requirements: [Node.js 18+](https://nodejs.org), [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

This project is a member of a Cargo workspace (`members = ["*/src-tauri"]`), so it is picked up automatically when the folder sits next to your other Tauri apps and shares one `./target` build cache.

```bash
cd material-xlsx
npm install        # installs the Tauri CLI
npm run dev        # runs the app with hot reload of the front-end
npm test           # unit tests for formulas, number formats and the data model
```

## Build

```bash
npm run build
```

Installers are written to `target/release/bundle/` of the workspace (for example `nsis/Material Xlsx_1.0.0_x64-setup.exe`). The setup and uninstall icons are configured in `src-tauri/tauri.conf.json` (`installerIcon`, `uninstallerIcon`).

## Project structure

```
material-xlsx/
├─ package.json            npm scripts: dev, build, test
├─ screenshot/             README images (image01 … image05)
├─ tests/                  unit tests (formulas, number formats, model)
├─ src/                    front-end
│  ├─ index.html           shell + SVG icon sprite
│  ├─ styles.css           Material Design 3 styles + motion
│  ├─ vendor/              ExcelJS, Material colour utilities (bundled, works offline)
│  └─ js/
│     ├─ main.js           entry point
│     ├─ app.js            toolbar, menus, tabs, dialogs, files, find & replace
│     ├─ grid.js           virtual grid, selection, editing, fill handle, clipboard
│     ├─ model.js          workbook / sheet / style model, history, structural edits
│     ├─ formula.js        parser + evaluator + function library
│     ├─ refs.js           cell references, lexer, reference rewriting
│     ├─ numfmt.js         number / date formats and typed-input parsing
│     ├─ io.js             XLSX (ExcelJS), CSV / TSV, base64 helpers
│     ├─ i18n.js           English / Vietnamese strings
│     ├─ theme.js          Material 3 colour roles, light / dark / system
│     ├─ widgets.js        menus, dialogs, ripple, snackbar, colour palette
│     └─ tauri.js          bridge to Tauri (with browser fallbacks)
└─ src-tauri/              Rust backend
   ├─ Cargo.toml  tauri.conf.json  build.rs
   ├─ capabilities/        window / dialog permissions
   ├─ icons/               app, installer.ico, uninstaller.ico, Store logos
   └─ src/                 main.rs, lib.rs (file I/O, clipboard, window state)
```

## Keyboard shortcuts

| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+N / O / S` | New / Open / Save | `Ctrl+Shift+S` | Save as |
| `Ctrl+Z / Y` | Undo / Redo | `Ctrl+C / X / V` | Copy / Cut / Paste |
| `Ctrl+B / I / U` | Bold / Italic / Underline | `Ctrl+F / H` | Find / Replace |
| `Ctrl+D / R` | Fill down / right | `Ctrl+Arrows` | Jump to data edge |
| `F2` | Edit cell | `Alt+Enter` | New line in cell |
| `Alt+=` | AutoSum | `Ctrl+= / − / 0` | Zoom in / out / reset |
| `F11` | Full screen | `Ctrl+,` | Settings |

## Known limitations

Charts, images, pivot tables, conditional formatting and data validation are not rendered and are not preserved when a workbook is saved. Shared formulas from other tools are imported as ordinary formulas; functions that Material Xlsx does not implement keep the value cached in the file.

## License

Released under the [MIT License](LICENSE) © 2026 **minhtrong67**.

<div align="center">

Made with ♥ by **minhtrong67** · AI assistant **Claude**

</div>
