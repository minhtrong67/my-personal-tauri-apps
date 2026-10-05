# Readme Viewer

A fast, lightweight desktop application for reading Markdown files on Windows. It follows the Windows 11 Fluent 2 design language (WinUI style: layered surfaces, accent color, Segoe UI Variable, 4px controls and 8px containers) and can be registered as the default program for `.md` files.

Author: **minhtrong67**
Built with the assistance of **Claude** (Anthropic).

## Features

**Reading**
- GitHub flavored Markdown: headings, lists, task lists, tables, block quotes, links, images and inline HTML (sanitized)
- Syntax highlighting for fenced code blocks, with a one click copy button
- Front matter is detected and shown in a collapsible block
- Local images referenced by relative paths are loaded from disk
- Comfortable reading layout with zoom from 60% to 220%

**Navigation**
- Outline pane built from headings, with the current section highlighted while you scroll
- Reading progress and word count with estimated reading time
- In page links jump to the right heading; links to other `.md` files open inside the app; web links open in your browser
- Find in document with highlighted matches, match counter and next or previous navigation

**Files**
- Open with a dialog, drag and drop, or by double clicking a `.md` file in Windows Explorer
- Single instance: opening another file reuses the running window
- Live reload: the view refreshes automatically when the file changes on disk, keeping your scroll position

**Experience**
- Light, dark and system themes; the toggle icon changes with the active mode
- Vietnamese and English interface, defaulting to your system language
- Responsive layout that adapts from wide monitors to small windows

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `O` | Open a file |
| `Ctrl` + `W` | Close the current file |
| `Ctrl` + `F` | Find in document |
| `Enter` / `Shift` + `Enter` | Next or previous match |
| `Esc` | Clear the search box |
| `Ctrl` + `B` | Show or hide the outline |
| `Ctrl` + `+` / `-` / `0` | Zoom in, zoom out, reset zoom |
| `Ctrl` + mouse wheel | Zoom |

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

## Set Readme Viewer as the default app

The installer registers the `.md`, `.markdown`, `.mdown` and `.mkd` file types. Windows does not allow an application to make itself the default, so confirm it once:

1. Right click any `.md` file and choose **Open with**, then **Choose another app**.
2. Select **Readme Viewer**.
3. Tick **Always use this app** and confirm.

If Windows shows an old icon after installing, refresh the icon cache with `ie4uinit.exe -ClearIconCache` or restart Explorer.

## Project structure

```
readme-viewer/
  src/                  Frontend: index.html and vendor/ (marked, DOMPurify, highlight.js)
  src-tauri/
    src/lib.rs          Rust core: open files, single instance, local image loading
    src/main.rs         Entry point
    tauri.conf.json     Window, bundle and file association settings
    capabilities/       Permissions granted to the main window
    icons/              Application icons
  package.json
```

## Technology

- [Tauri 2](https://tauri.app) with a small Rust core and the WebView2 runtime that ships with Windows, so no browser engine is bundled and the installer stays small
- Vanilla HTML, CSS and JavaScript for the interface, with no runtime framework
- [marked](https://marked.js.org) for Markdown parsing, [DOMPurify](https://github.com/cure53/DOMPurify) for sanitizing, [highlight.js](https://highlightjs.org) for code highlighting

## Window frame

The window uses a custom Fluent style title bar (`decorations` is `false` in `src-tauri/tauri.conf.json`). Set it to `true` to use the native Windows title bar instead; the custom bar then hides itself automatically.

## Changing the app icon

Icons are embedded at compile time. After replacing files in `src-tauri/icons/`, run `cargo clean -p readme-viewer` and build again.

## Roadmap

- Mermaid diagrams and math formulas
- Recent files list
- Export to PDF or HTML
- Table of contents search

## Credits

Designed and maintained by **minhtrong67**. Development was supported by Claude, an AI assistant made by Anthropic, which helped with design, implementation and documentation.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
