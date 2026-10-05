# CSV Viewer

A fast, minimalist desktop application for opening, exploring, filtering and exporting CSV files on Windows with a very small footprint. It follows the Windows 11 Fluent 2 design language (WinUI style: layered surfaces, accent color, Segoe UI Variable, 4px controls and 8px containers) and can be registered as the default program for `.csv` files.

Author: **minhtrong67**
Built with the assistance of **Claude** (Anthropic).

## Features

**Viewing**
- Table view with grid lines, zebra rows, sticky headers and right aligned numeric columns
- Card view in two layouts: responsive grid and single column list
- Row details pane that shows every field of the selected row
- Pagination with 50, 100, 500 or 1000 rows per page

**Exploring data**
- Global search with an optional column scope
- Per column filter inputs directly under the table header
- Advanced filter accordion with comparison operators: equals, not equal, greater than, less than, greater or equal, less or equal, contains, starts with, ends with, is empty, is not empty
- Click a column header to sort ascending, descending or clear; numbers are sorted numerically
- Drag the edge of a column header to resize it
- Show or hide columns with one click

**Files and export**
- Open with a dialog, drag and drop, or by double clicking a `.csv` or `.tsv` file in Windows Explorer
- Automatic delimiter detection (comma, semicolon, tab, pipe) with manual override
- Correct handling of quoted fields, embedded delimiters and line breaks, and UTF-8 BOM
- Export the current result (filtered, sorted, visible columns only) to CSV, JSON or Excel (.xlsx)
- Copy the selected row or the filtered result as tab separated text, ready to paste into a spreadsheet
- Close the current file and return to the start screen

**Experience**
- Light, dark and system themes; the toggle icon changes with the active mode
- Vietnamese and English interface, defaulting to your system language
- Responsive layout that adapts from wide monitors to small windows

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `O` | Open a file |
| `Ctrl` + `W` | Close the current file |
| `Ctrl` + `F` | Focus the search box |
| `Esc` | Clear the search box (while it is focused) |
| `Up` / `Down` | Move the row selection |
| Double click a cell | Copy the cell value |

## Getting started

Prerequisites on Windows 10 or 11:

- [Node.js](https://nodejs.org) 18 or later
- [Rust](https://rustup.rs) (stable toolchain)
- Microsoft C++ Build Tools (the "Desktop development with C++" workload of Visual Studio Build Tools)
- Microsoft Edge WebView2 Runtime (already included with Windows 11 and current Windows 10)

```bash
npm install
npm run dev      # run in development
npm run build    # build the Windows installer
```

The installer is written to `src-tauri/target/release/bundle/nsis/`. The first Rust build takes a few minutes because dependencies are compiled once; later builds are fast.

## Set CSV Viewer as the default app

The installer registers the `.csv` and `.tsv` file types. Windows does not allow an application to make itself the default, so confirm it once:

1. Right click any `.csv` file and choose **Open with**, then **Choose another app**.
2. Select **CSV Viewer**.
3. Tick **Always use this app** and confirm.

If Windows still shows an old icon after installing, restart Explorer or sign out and back in to refresh the icon cache.

## Project structure

```
csv-viewer/
  src/                  Frontend: index.html and vendor/xlsx.mini.min.js
  src-tauri/
    src/lib.rs          Rust core: open files, single instance, native save dialog
    src/main.rs         Entry point
    tauri.conf.json     Window, bundle and file association settings
    capabilities/       Permissions granted to the main window
    icons/              Application icons
  package.json
```

## Technology

- [Tauri 2](https://tauri.app) with a small Rust core and the WebView2 runtime that ships with Windows, so no browser engine is bundled and the installer stays small
- Vanilla HTML, CSS and JavaScript for the interface, with no runtime framework
- [SheetJS](https://sheetjs.com) (`xlsx`) for Excel export, loaded only when needed

## Disk usage and build speed

Rust stores compiled dependencies in a `target/` folder, which can reach several GB. To avoid one copy per project, keep all Tauri projects inside one parent folder that is a Cargo workspace:

```
D:\tauri-apps\
  Cargo.toml            Workspace file (members = ["*/src-tauri"])
  target\               The single shared build cache
  csv-viewer-tauri\     This project
  another-app\          Future projects
```

Every project in that folder is detected automatically and reuses the same compiled dependencies, so new projects build in seconds instead of minutes. The installer is written to `<parent>\target\release\bundle\nsis\`.

Notes:

- Build profiles (`[profile.dev]`, `[profile.release]`) are defined in the parent `Cargo.toml`, because Cargo ignores them in member crates.
- Crate names must be unique across the workspace.
- The `CARGO_TARGET_DIR` environment variable overrides the workspace cache, so remove it if you set it earlier.
- The interface in `src/index.html` also runs in a normal browser, so most UI changes can be tested without starting Tauri.
- `cargo clean` in the parent folder removes the shared cache.

## Changing the app icon

Icons are embedded into the executable at compile time, so Cargo may keep serving an old icon from its cache. After replacing files in `src-tauri/icons/`, force a fresh build from the workspace folder:

```bash
cargo clean -p csv-viewer
npm run build
```

If Windows still shows the previous icon after reinstalling, refresh the icon cache by running `ie4uinit.exe -show` or restarting Explorer.

## Window frame

The window uses a custom Fluent style title bar (`decorations` is `false` in `src-tauri/tauri.conf.json`). Set it to `true` to use the native Windows title bar instead; the custom bar then hides itself automatically.

## Roadmap

- Automatic encoding detection (Windows-1258, UTF-16)
- Column statistics (minimum, maximum, average)
- Virtual scrolling for very large files
- Inline cell editing and saving
- Recent files list

## Credits

Designed and maintained by **minhtrong67**. Development was supported by Claude, an AI assistant made by Anthropic, which helped with design, implementation and documentation.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
