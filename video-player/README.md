<div align="center">

<img src="src-tauri/icons/icon.png" width="112" alt="Lumina icon" />

# Lumina

**A fast, full-featured video player for Windows with a Material Design 3 interface.**

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-DEA584?logo=rust&logoColor=black)
![Design](https://img.shields.io/badge/Design-Material%20Design%203-6750A4)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

English · [Tiếng Việt](README.vi.md)

</div>

---

## Highlights

- **Material Design 3 everywhere** – dynamic color palette generated from a single seed color, tonal surfaces, state layers, rounded shapes, M3 sliders, dialogs and snackbars.
- **Light, dark or follow-system theme** with a fully customizable theme color (presets + any custom color).
- **English and Vietnamese UI** – switch instantly in Settings, or let Lumina follow your system language.
- **System UI font** (`system-ui`) – Lumina uses the native Windows font, no bundled typefaces.
- **Professional installer** – custom app icon, setup (installer) icon and uninstall icon in the same design language.

## Features

### Library
- **Automatic Videos folder scan** – on startup Lumina scans the Windows *Videos* folder (including sub-folders such as *Captures* and *Screen Recordings*) and imports everything into the **Library** tab
- **Refresh button** (title bar, Library tab, or `F5`) rescans on demand; deleted files disappear from the library, new and changed files are picked up
- Re-importing a file **overwrites** its entry instead of creating a duplicate; entries are matched by path
- Safe by design: if a drive or folder is temporarily offline (e.g. an unplugged disk), its videos are kept
- Add extra folders in *Settings → Library*; search, sort by date / name / size; thumbnails are generated lazily for the videos on screen and cached

### Playback
| | |
|---|---|
| Open files, whole folders, drag & drop, or *Open with Lumina* from Explorer | Single-instance: opening another file reuses the running window |
| Playlist / queue with drag-to-reorder, shuffle and repeat (off / all / one) | Auto-queues the other videos in the same folder (natural sort), can be disabled |
| **Resume playback** – remembers the position of every video | **Continue watching** shelf with thumbnails and progress bars |
| Speed 0.25× – 4× | **A-B loop** with markers on the seek bar |
| Frame-by-frame stepping (`,` and `.`) | Seek-bar **hover preview** thumbnails |
| Volume wheel, mute, **volume boost up to 200 %** and **night mode** (dynamic range compression) | Double-click left / right to skip, center to toggle fullscreen |

### Picture
- Fit / fill (crop) / stretch, zoom up to 400 % with drag-to-pan
- Rotate 90° and flip horizontally / vertically
- Brightness, contrast, saturation and hue adjustments
- **Screenshot** of the current frame, saved as PNG to `Pictures\Lumina`

### Subtitles
- Automatically finds `.srt`, `.vtt`, `.ass`, `.ssa` next to the video (or in a `Subs` / `Subtitles` folder) and prefers your UI language
- Load any subtitle file manually or drop it onto the window
- Smart encoding detection (BOM, UTF-8, Windows-1258 for Vietnamese, Windows-1252 otherwise)
- Adjustable delay (`G` / `H`), size, color, background (none / shadow / box), opacity and vertical position
- Basic `<i>`, `<b>`, `<u>` styling and ASS override tags handling

### Windows integration
- Frameless Material title bar, fullscreen and **mini player** (always on top)
- Windows media keys / system media overlay
- Sleep timer (15 – 120 minutes or after the current video)
- File associations for common video types (configured in the installer)

## Supported formats

Lumina plays video through the **Microsoft Edge WebView2** media stack, so support depends on the codecs available on your PC.

| Container | Typical codecs | Notes |
|---|---|---|
| MP4 / M4V / MOV | H.264 + AAC | Works everywhere |
| WebM | VP8 / VP9 / AV1 + Vorbis / Opus | Works everywhere (AV1 needs the AV1 Video Extension on some PCs) |
| MKV | H.264 / VP9 + AAC / Opus / MP3 | Works when the inner codecs are supported |
| HEVC / H.265 | – | Needs the *HEVC Video Extensions* from the Microsoft Store (hardware decoding) |
| AVI, WMV, FLV, MPG | – | Often unsupported; Lumina offers **Open with default app** when a file fails |

> Embedded (in-container) subtitle tracks and multiple audio tracks are not exposed by WebView2. Use external subtitle files.

## Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `Space` / `K` | Play / pause | `M` | Mute |
| `←` / `→` | Seek (5 / 10 / 15 s, configurable) | `F` / `F11` | Fullscreen |
| `J` / `L` | Seek 10 s | `[` / `]` | Slower / faster |
| `↑` / `↓` | Volume | `,` / `.` | Previous / next frame |
| `Shift+N` / `Shift+P` | Next / previous video | `C` / `V` | Cycle / toggle subtitles |
| `G` / `H` | Subtitle delay − / + | `A` | A-B loop (A → B → clear) |
| `S` | Screenshot | `Q` | Playlist |
| `R` | Rotate 90° | `T` | Mini player |
| `0` – `9` | Jump to 0 – 90 % | `I` | Video info |
| `Ctrl+O` | Open file (`Shift`: folder) | `Esc` | Exit fullscreen / mini |
| `F5` | Refresh library (Home screen) | | |

## Getting started

### Requirements
- Windows 10 / 11 (WebView2 runtime is preinstalled on Windows 11 and recent Windows 10)
- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) stable and the *Desktop development with C++* build tools
- Tauri prerequisites: <https://tauri.app/start/prerequisites/>

### Run in development
```bash
cd video-player
npm install
npm run tauri dev
```

### Build the installer
```bash
npm run tauri build
```
The NSIS installer (`Lumina_1.0.0_x64-setup.exe`) is created in `target/release/bundle/nsis/`.
The installer, the uninstaller and the app all use the Lumina icon from `src-tauri/icons/`.

### Using it inside an existing Cargo workspace
If this folder lives next to other Tauri apps that share a root `Cargo.toml`, add it to the workspace members:

```toml
[workspace]
members = [
  # ...your existing apps...
  "video-player/src-tauri",
]
```

## Customization

| What | Where |
|---|---|
| App icon | replace `src-tauri/icons/icon.png` (1024 × 1024) and run `npm run tauri icon src-tauri/icons/icon.png` |
| Installer + uninstaller icon | `src-tauri/icons/installer.ico` (set in `bundle.windows.nsis` of `tauri.conf.json`) |
| Default theme color | `defaultSettings.seedColor` in `src/lib/types.ts` |
| Add a language | add a dictionary in `src/lib/i18n.ts` (the TypeScript compiler checks that every key is translated) |

## Project structure

```
video-player/
├─ src/                    React + TypeScript + Tailwind UI
│  ├─ lib/                 store (zustand), engine (<video> + Web Audio), i18n, subtitles parser, theme (M3)
│  ├─ components/          Player, Controls, SeekBar, Subtitles, QueuePanel, Dialogs, TitleBar, ui kit
│  └─ views/               Home, Settings
└─ src-tauri/              Rust backend: folder scan, sibling/subtitle discovery, encoding detection,
                           state storage, screenshots, single-instance, file associations
```

User data (settings, library, history, playback positions) is stored in `%APPDATA%\com.minhtrong67.lumina\state.json`; thumbnails are cached in `%LOCALAPPDATA%\com.minhtrong67.lumina\thumbs`.

## Troubleshooting

- **"This video can't be played"** – the codec is not supported by WebView2. Install the *HEVC Video Extensions* (for H.265) or use **Open with default app**.
- **No sound with volume boost / night mode** – these effects use the Web Audio API; if your system blocks it, the dialog shows a notice and playback continues normally.
- **Old icon still shown in Explorer after reinstall** – Windows caches icons; rename the file or restart Explorer.

## Credits

Designed and developed by **minhtrong67**, with the support of the AI assistant **Claude** (Anthropic).

Built with [Tauri](https://tauri.app), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Zustand](https://zustand-demo.pmnd.rs), [Material Color Utilities](https://github.com/material-foundation/material-color-utilities) and [Material Symbols](https://fonts.google.com/icons).

## License

[MIT](LICENSE) © 2026 minhtrong67
