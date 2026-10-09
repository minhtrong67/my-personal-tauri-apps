<div align="center">

<img src="src-tauri/icons/icon.png" width="112" alt="Material Video Player icon" />

# Material Video Player

**A fast, full-featured video player for Windows with a Material Design 3 interface.**

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-DEA584?logo=rust&logoColor=black)
![Design](https://img.shields.io/badge/Design-Material%20Design%203-6750A4)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

![Author](https://img.shields.io/badge/Author-minhtrong67-6750A4?style=for-the-badge)
![AI](https://img.shields.io/badge/AI%20support-Claude-D97757?style=for-the-badge)

English · [Tiếng Việt](README.vi.md)

</div>

---

## Table of contents

1. [Introduction](#introduction)
2. [Screenshots](#screenshots)
3. [Features](#features)
4. [Download](#download)
5. [Installation](#installation)
6. [Tech Stack](#tech-stack)
7. [Development](#development)
8. [Build](#build)
9. [Project Structure](#project-structure)
10. [License](#license)

---

## Introduction

**Material Video Player** is a desktop video player for Windows built with [Tauri](https://tauri.app), React and Rust. It combines a lightweight native shell (a few MB, low memory use) with a modern **Material Design 3** interface:

- **Material You color system** – the whole palette is generated from one theme color you can change, in **light**, **dark** or **follow-system** mode.
- **English and Vietnamese** user interface, switchable at any time.
- **System UI font** (`system-ui`) – it uses the native Windows font, no bundled typefaces.
- A **personal library** that automatically scans your Windows *Videos* folder, remembers where you stopped in every video and generates thumbnails.
- Everything you expect from a serious player: playlists, subtitles, speed control, A-B loop, screenshots, mini player, keyboard shortcuts and more.

> ✨ Designed and developed by **minhtrong67** — with the support of the AI assistant **Claude** (Anthropic).

## Screenshots

> The images live in the [`screenshot`](screenshot) folder and are named `image01.png`, `image02.png`, `image03.png`… Replace each placeholder with a real screenshot using the same file name.

| Library (grid) | Library (list) |
|:---:|:---:|
| ![Library grid](screenshot/image01.png) | ![Library list](screenshot/image02.png) |

| Player | Playlist panel |
|:---:|:---:|
| ![Player](screenshot/image03.png) | ![Playlist panel](screenshot/image04.png) |

| Settings |
|:---:|
| ![Settings](screenshot/image05.png) |

## Features

### Library
- **Automatic scan of the Windows Videos folder** on startup, including sub-folders such as *Captures* and *Screen Recordings*.
- **Refresh button** (title bar, Library tab or `F5`) rescans on demand: new files are added, changed files are updated and deleted files disappear.
- Re-importing a file **overwrites** its entry instead of creating a duplicate (entries are matched by path).
- Safe by design: if a drive or folder is temporarily offline, its videos are kept.
- Add **extra library folders** in *Settings → Library*.
- Search, sort by date / name / size and switch between **list and grid view**.
- Thumbnails are generated lazily for the videos on screen (black frames are skipped), cached on disk and shown with a skeleton shimmer while loading.

### Playback
- Open files or whole folders, drag & drop, or **Open with** from Explorer; a second launch reuses the running window.
- Playlist with drag-to-reorder, shuffle and repeat (off / all / one). Opening one file also queues the other videos in the same folder (can be disabled).
- **Resume playback** – the position of every video is remembered, with a *Continue watching* shelf on the home screen.
- Speed from **0.25× to 4×**, frame-by-frame stepping, **A-B loop** with markers on the seek bar.
- Seek bar with **hover preview thumbnails** and buffered range.
- Mouse wheel for volume, **volume boost up to 200 %**, **night mode** (dynamic range compression), double-click left / right to skip and in the middle for fullscreen.
- Sleep timer (15 – 120 minutes or after the current video).

### Playlist panel & context menu
- The playlist side panel has a **search box**, a **list / grid** switch (thumbnails in both), drag-to-reorder, a per-item context menu and keeps the playing video in view.
- **Right-click the video** for a full menu: play / pause, skip (±10 s, ±30 s, ±1 min), speed, playlist actions, subtitles, audio (mute, night mode, boost), video (fit, rotate, flip, adjustments), A-B loop, screenshot, **copy frame to clipboard**, fullscreen, mini player, always on top, file actions and close video.

### Picture
- Fit / fill (crop) / stretch, zoom up to 400 % with drag-to-pan.
- Rotate 90° and flip horizontally / vertically.
- Brightness, contrast, saturation and hue adjustments.
- **Screenshot** of the current frame, saved as PNG in `Pictures\Material Video Player`.

### Subtitles
- Automatically finds `.srt`, `.vtt`, `.ass` and `.ssa` files next to the video (or in a `Subs` / `Subtitles` folder) and prefers your UI language.
- Load any subtitle file manually or drop it onto the window.
- Smart encoding detection (BOM, UTF-8, Windows-1258 for Vietnamese, Windows-1252 otherwise).
- Adjustable delay (`G` / `H`), size, color, background (none / shadow / box), opacity and vertical position.

### Appearance & languages
- Light, dark or system theme, with Material 3 palette generated from any theme color (presets + custom color picker).
- English and Vietnamese UI, automatic by default.
- Smooth Material-style motion: staggered card entrances, hover lift, sliding toggles, fade-in video and screen transitions (reduced automatically when Windows animations are off).

### Windows integration
- **Remembers the window size, position and maximized state** and restores them on the next launch (fullscreen and mini player are never saved; if a monitor is unplugged the window is re-centered).
- **"Always start in fullscreen"** option in *Settings → Window* (press `F11` or `Esc` to leave fullscreen).
- Frameless Material title bar, fullscreen and a **mini player** that stays on top.
- Windows media keys and system media overlay.
- File associations for common video types (set up by the installer).

### Supported formats

Playback uses the **Microsoft Edge WebView2** media stack, so support depends on the codecs available on your PC.

| Container | Typical codecs | Notes |
|---|---|---|
| MP4 / M4V / MOV | H.264 + AAC | Works everywhere |
| WebM | VP8 / VP9 / AV1 + Vorbis / Opus | AV1 may need the *AV1 Video Extension* |
| MKV | H.264 / VP9 + AAC / Opus / MP3 | Works when the inner codecs are supported |
| HEVC / H.265 | – | Needs *HEVC Video Extensions* from the Microsoft Store |
| AVI, WMV, FLV, MPG | – | Often unsupported – the player offers **Open with default app** |

> Embedded (in-container) subtitle tracks and multiple audio tracks are not exposed by WebView2; use external subtitle files.

### Keyboard shortcuts

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
| `Ctrl+O` | Open file (`Shift`: folder) | `Esc` | Exit fullscreen / mini player |
| `F5` | Refresh library (home screen) | Right-click | Context menu |

## Download

Download the latest installer from the **Releases** page of this repository:

| File | Description |
|---|---|
| `Material Video Player_1.0.0_x64-setup.exe` | Installer for Windows 10 / 11 (64-bit) – recommended |

**System requirements**

| | |
|---|---|
| OS | Windows 10 (1809 or newer) or Windows 11, 64-bit |
| Runtime | Microsoft Edge WebView2 (preinstalled on Windows 11 and up-to-date Windows 10) |
| Disk | A few hundred MB free is more than enough (installer is only a few MB) |

Prefer to build it yourself? See [Build](#build).

## Installation

1. Run **`Material Video Player_1.0.0_x64-setup.exe`**. It installs per user, so **no administrator rights** are needed.
2. If Windows SmartScreen shows *"Windows protected your PC"* (the installer is not code-signed), click **More info → Run anyway**.
3. Follow the wizard and launch **Material Video Player** from the Start menu.
4. On first launch the app scans your **Videos** folder automatically. Add other folders in *Settings → Library*.

**Open videos from Explorer** – right-click a video → *Open with* → *Material Video Player* (you can also make it the default app in *Settings → Apps → Default apps*).

**Uninstall** – *Settings → Apps → Installed apps → Material Video Player → Uninstall* (or run `uninstall.exe` from the install folder). Your settings and history stay in `%APPDATA%\com.minhtrong67.material-video-player` and thumbnail cache in `%LOCALAPPDATA%\com.minhtrong67.material-video-player`; delete these folders for a completely clean removal.

**Troubleshooting**

| Problem | Solution |
|---|---|
| *"This video can't be played"* | The codec is not supported by WebView2. Install *HEVC Video Extensions* (H.265) or click **Open with default app**. |
| No effect from volume boost / night mode | They use the Web Audio API; if blocked, the dialog shows a notice and normal playback continues. |
| Old icon still shown after reinstall | Windows caches icons – rename the file or restart Explorer. |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) – single-instance, dialogs, asset protocol, file associations |
| UI | [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org) |
| Build tool | [Vite 5](https://vitejs.dev) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com) with Material 3 design tokens |
| Design system | Material Design 3 – [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) (dynamic color), [Material Symbols](https://fonts.google.com/icons) icons, `system-ui` font |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Playback | HTML5 `<video>` on Microsoft Edge WebView2 + Web Audio API (boost, night mode) |
| Rust crates | `tauri`, `tauri-plugin-dialog`, `tauri-plugin-single-instance`, `walkdir`, `encoding_rs`, `base64`, `serde` |
| Installer | NSIS (via the Tauri bundler) |

## Development

**Prerequisites**

- Windows 10 / 11 with WebView2
- [Node.js](https://nodejs.org) 18 or newer
- [Rust](https://rustup.rs) (stable) and *Desktop development with C++* (Visual Studio Build Tools)
- Tauri prerequisites: <https://tauri.app/start/prerequisites/>

**Run in development**

```bash
cd material-video-player
npm install
npm run dev
```

`npm run dev` launches the desktop app (Tauri) with hot reload. The first run compiles the Rust side and takes a few minutes; later runs are fast. The UI hot-reloads while you edit.

**Useful commands**

| Command | What it does |
|---|---|
| `npm run dev` | Run the desktop app (Tauri) with hot reload |
| `npm run build` | Build the Windows installer |
| `npm run vite:dev` | UI only in a browser (Tauri features such as file access are unavailable) |
| `npx tsc --noEmit` | Type-check the frontend |
| `cargo check` (inside `src-tauri`) | Type-check the Rust backend |

**Using it inside an existing Cargo workspace** – if this folder sits next to other Tauri apps that share a root `Cargo.toml`, add it to the workspace members:

```toml
[workspace]
members = [
  # ...your existing apps...
  "material-video-player/src-tauri",
]
```

**Customization**

| What | Where |
|---|---|
| Default theme color | `defaultSettings.seedColor` in `src/lib/types.ts` |
| Add a language | add a dictionary in `src/lib/i18n.ts` (the compiler checks that every key is translated) |
| Default window size | `app.windows` in `src-tauri/tauri.conf.json` |
| Supported video extensions | `VIDEO_EXTS` in `src-tauri/src/lib.rs` and `src/lib/tauri.ts` |

**User data** – settings, library, history and playback positions: `%APPDATA%\com.minhtrong67.material-video-player\state.json`; window geometry: `window.json` in the same folder; thumbnails: `%LOCALAPPDATA%\com.minhtrong67.material-video-player\thumbs`.

## Build

```bash
npm install
npm run build
```

Output (when the project is part of a Cargo workspace, `target` is at the workspace root):

| Artifact | Path |
|---|---|
| Installer | `target/release/bundle/nsis/Material Video Player_1.0.0_x64-setup.exe` |
| Portable executable | `target/release/material-video-player.exe` |

Notes:
- The first build downloads the NSIS tooling, so an internet connection is required.
- To change the version, edit `version` in both `package.json` and `src-tauri/tauri.conf.json`.
- The installer is not code-signed; see the [Tauri signing guide](https://tauri.app/distribute/sign/windows/) if you want to sign it.

**Icons** – the app icon, the setup (installer) icon and the uninstall icon share the same artwork and ship with every standard Windows display size:

| File | Used for | Sizes |
|---|---|---|
| `src-tauri/icons/icon.ico` | app, taskbar, Explorer, window | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `src-tauri/icons/installer.ico` | setup `.exe` **and** `uninstall.exe` | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` (256), `256x256.png`, `icon.png` (512) | Tauri / bundler / high-DPI | as named |

To use your own artwork replace `src-tauri/icons/icon.png` (square, ≥ 512 px) and run `npx tauri icon src-tauri/icons/icon.png`, then keep all the standard sizes in `installer.ico`.

## Project Structure

```
material-video-player/
├─ screenshot/                README screenshots (image01.png … image05.png)
├─ public/                    static assets (logo used by the UI)
├─ src/                       React + TypeScript + Tailwind frontend
│  ├─ main.tsx                entry point
│  ├─ App.tsx                 layout, global shortcuts, drag & drop, theme
│  ├─ index.css               Material 3 tokens, motion, sliders
│  ├─ lib/
│  │  ├─ store.ts             application state (zustand): queue, library, playback, settings
│  │  ├─ engine.ts            <video> helpers, frame step, volume boost / night mode, screenshot
│  │  ├─ i18n.ts              English / Vietnamese dictionaries
│  │  ├─ theme.ts             Material 3 palette generation from a seed color
│  │  ├─ subtitles.ts         SRT / VTT / ASS parsers
│  │  ├─ thumbs.ts            thumbnail generator (skips black frames)
│  │  ├─ videoMenu.ts         right-click menu of the video
│  │  ├─ tauri.ts, window.ts  bridge to the Rust commands and window helpers
│  │  └─ types.ts, utils.ts, useT.ts
│  ├─ components/             Player, Controls, SeekBar, VideoSurface, Subtitles, QueuePanel,
│  │                          Poster, Dialogs, TitleBar, ViewToggle, ui (M3 kit)
│  └─ views/                  Home (recent + library), Settings
├─ src-tauri/                 Rust backend
│  ├─ src/lib.rs              commands: scan, subtitles, state, screenshots, window memory
│  ├─ src/main.rs             entry point
│  ├─ capabilities/           Tauri permissions
│  ├─ icons/                  app, setup and uninstall icons
│  ├─ Cargo.toml
│  └─ tauri.conf.json         app, window, installer and file-association config
├─ README.md / README.vi.md
├─ package.json, vite.config.ts, tailwind.config.js, tsconfig.json
└─ LICENSE
```

## License

Released under the [MIT License](LICENSE) © 2026 minhtrong67.

Designed and developed by **minhtrong67** with the support of the AI assistant **Claude** (Anthropic). Built with [Tauri](https://tauri.app), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Zustand](https://zustand-demo.pmnd.rs), [Material Color Utilities](https://github.com/material-foundation/material-color-utilities) and [Material Symbols](https://fonts.google.com/icons).
