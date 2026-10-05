# Case Converter

A fast, lightweight desktop application for converting text between letter cases, with a set of handy text tools. It follows the Windows 11 Fluent 2 design language (WinUI style: layered surfaces, Segoe UI Variable, 4px controls and 8px containers) and lets you pick any accent color.

Author: **minhtrong67**
Built with the assistance of **Claude** (Anthropic).

## Features

**Convert** (19 styles, updated live as you type)
- Text: UPPERCASE, lowercase, Title Case (with an optional smart mode that keeps small words such as a, an, the), Sentence case, Capitalize Each Word, aLtErNaTiNg, tOGGLE cASE, Reverse text
- Code: camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, Train-Case, COBOL-CASE, dot.case, path/case
- Other: URL slug and Remove diacritics (Vietnamese aware, including the letter đ)
- Code styles work line by line, so you can convert a whole list of identifiers at once, and they understand existing formats such as `XMLHttpRequest` or `someVariableName2Go`

**All cases**
- See every conversion of your text at once and click any row to copy it

**Tools**
- Remove duplicate lines, sort A to Z or Z to A (natural order, Vietnamese aware), reverse line order, remove empty lines, trim lines, collapse extra spaces, join lines into one, number the lines

**Workflow**
- Copy the result with one click or `Ctrl` + `Shift` + `C`
- Use the result as the new source text to chain operations
- Open a text file, drop a file onto the window, paste from the clipboard, or save the result as a `.txt` file
- Character, word and line counters
- Your draft, chosen style and settings are remembered

**Fluent 2 experience**
- Light, dark and system themes
- Customizable accent color: 20 Windows style presets or any custom color from the color picker. Contrast is adjusted automatically so text stays readable in both light and dark themes
- Vietnamese and English interface, defaulting to your system language
- Adaptive layout: two columns on wide windows, stacked on narrow ones
- Custom Fluent style title bar with Windows caption buttons

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `Shift` + `C` | Copy the result |
| `Ctrl` + `Shift` + `X` | Clear the source text |
| `Alt` + `1` / `2` / `3` | Switch between Convert, All cases and Tools |

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
case-converter/
  src/                  Frontend: index.html
  src-tauri/
    src/lib.rs          Rust core: read a text file, native save dialog
    src/main.rs         Entry point
    tauri.conf.json     Window and bundle settings
    capabilities/       Permissions granted to the main window
    icons/              Application icons (Fluent 2 style)
  package.json
```

## Technology

- [Tauri 2](https://tauri.app) with a small Rust core and the WebView2 runtime that ships with Windows, so no browser engine is bundled and the installer stays small
- Vanilla HTML, CSS and JavaScript with no runtime framework
- Segoe UI Variable and Segoe Fluent Icons, which ship with Windows 11

## Window frame

The window uses a custom Fluent style title bar (`decorations` is `false` in `src-tauri/tauri.conf.json`). Set it to `true` to use the native Windows title bar instead; the custom bar then hides itself automatically.

## Changing the app icon

Icons are embedded at compile time. After replacing files in `src-tauri/icons/`, run `cargo clean -p case-converter` and build again.

## Roadmap

- Find and replace with regular expressions
- Custom word delimiters and acronym handling
- Conversion history
- Batch convert multiple files

## Credits

Designed and maintained by **minhtrong67**. Development was supported by Claude, an AI assistant made by Anthropic, which helped with design, implementation and documentation.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
