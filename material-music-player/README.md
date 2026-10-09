<div align="center">

<img src="src-tauri/icons/icon.png" width="112" alt="Material Music Player icon" />

# Material Music Player

**A beautiful local music player for Windows with a Material Design 3 interface.**

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

**Material Music Player** plays the music stored on your PC. It is built with [Tauri](https://tauri.app), React and Rust, so it is small, fast and light on memory, and it wears a modern **Material Design 3** interface:

- **Material You colors** generated from one theme color of your choice – or from the cover art of the song that is playing – in **light**, **dark** or **follow-system** mode.
- **English and Vietnamese** user interface, switchable at any time.
- **System UI font** (`system-ui`) – the native Windows font, no bundled typefaces.
- A **library** that scans your Windows *Music* folder automatically, reads tags and cover art, and builds playlists from folders.
- A full player: queue, playlists, equalizer, synced lyrics, sleep timer, mini player and more.

> ✨ Designed and developed by **minhtrong67** — with the support of the AI assistant **Claude** (Anthropic).

## Screenshots

> The images live in the [`screenshot`](screenshot) folder and are named `image01.png`, `image02.png`, `image03.png`… Replace each placeholder with a real screenshot using the same file name.

| Home | Songs (list) |
|:---:|:---:|
| ![Home](screenshot/image01.png) | ![Songs](screenshot/image02.png) |

| Albums (grid) | Now Playing |
|:---:|:---:|
| ![Albums](screenshot/image03.png) | ![Now Playing](screenshot/image04.png) |

| Settings |
|:---:|
| ![Settings](screenshot/image05.png) |

## Features

### Library
- **Import a folder** (recursive) – it becomes a playlist automatically, with a *Rescan* button to stay in sync.
- Import single files, **drag & drop** files or folders, or **Open with** from Explorer (mp3, flac, wav, ogg, opus, m4a, aac).
- **Automatic scan of the Windows Music folder** on startup; a **Refresh button** (title bar or `F5`) rescans on demand. New songs are added, changed ones updated and deleted ones removed.
- Importing a song that already exists **overwrites** it instead of creating a duplicate (matched by path); drives that are offline never wipe your library.
- Tags (title, artist, album, year, genre, track) and embedded **cover art** via `lofty`.
- Browse by Songs, Albums, Artists, Playlists, Favorites and Recent – with **list / grid view** on every tab, accent-insensitive search (`Ctrl+F`) and sorting.
- Virtualized lists: smooth with tens of thousands of songs.
- Back up / restore the library (JSON), remove missing files.

### Playback
- Play / pause, previous / next, seek, volume, shuffle and repeat (off / all / one).
- Queue: play next, add to queue, drag to reorder.
- Playlists: create, rename, delete, reorder, import / export **M3U / M3U8**.
- **10-band equalizer** with presets and preamp, playback speed 0.5× – 2×.
- **Synced lyrics** (`.lrc` next to the song or embedded in the tags) – click a line to seek.
- Spectrum visualizer, full-window *Now Playing* view and a **mini player** that stays on top.
- Sleep timer (15 – 120 minutes or after the current song), Windows media keys, restore of the previous session.

### Appearance & languages
- Light, dark or system theme; theme color presets + custom color; **dynamic color from the cover art**.
- English / Vietnamese UI, automatic by default.
- Smooth Material motion: staggered card entrances, hover lift, sliding toggles, press feedback and screen transitions (reduced automatically when Windows animations are off).

### Windows integration
- **Remembers the window size, position and maximized state** and restores them on the next launch (fullscreen and mini player are never saved; if a monitor is unplugged the window is re-centered).
- **"Always start in fullscreen"** option in *Settings → System* (`F11` or `Esc` leaves fullscreen).
- System tray with play / pause / previous / next, optional *close to tray*, always on top, single instance.
- Frameless Material title bar.

### Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `Space` | Play / pause | `M` | Mute |
| `Ctrl+←` / `Ctrl+→` | Previous / next song | `S` | Shuffle |
| `←` / `→` | Seek 5 s | `R` | Repeat mode |
| `↑` / `↓` | Volume | `L` | Favorite the playing song |
| `Q` | Queue | `N` | Now Playing |
| `Ctrl+F` | Search | `F5` | Refresh library |
| `F11` | Fullscreen | `Esc` | Close dialog / leave fullscreen |

## Download

Download the latest installer from the **Releases** page of this repository:

| File | Description |
|---|---|
| `Material Music Player_1.0.0_x64-setup.exe` | Installer for Windows 10 / 11 (64-bit) – recommended |

| System requirements | |
|---|---|
| OS | Windows 10 (1809 or newer) or Windows 11, 64-bit |
| Runtime | Microsoft Edge WebView2 (preinstalled on Windows 11 and up-to-date Windows 10) |

Supported audio: **MP3, FLAC, WAV, OGG, Opus, M4A, AAC** (playback uses the WebView2 media stack). Prefer to build it yourself? See [Build](#build).

## Installation

1. Run **`Material Music Player_1.0.0_x64-setup.exe`**. It installs per user, so **no administrator rights** are needed.
2. If Windows SmartScreen shows *"Windows protected your PC"* (the installer is not code-signed), click **More info → Run anyway**.
3. Follow the wizard and launch **Material Music Player** from the Start menu.
4. The app scans your **Music** folder automatically; add more with *Add folder* or by dragging folders into the window.

**Uninstall** – *Settings → Apps → Installed apps → Material Music Player → Uninstall* (or run `uninstall.exe` in the install folder). Data lives in `%APPDATA%\com.minhtrong67.material-music-player` and cover cache in `%LOCALAPPDATA%\com.minhtrong67.material-music-player`; delete them for a completely clean removal.

**Upgrading from "Melodia"** – the first launch automatically imports the library saved by the old Melodia build.

| Problem | Solution |
|---|---|
| Equalizer / visualizer not working | The WebView did not allow audio processing of local files; playback continues normally and the dialog shows a notice. |
| Old icon still shown after reinstall | Windows caches icons – rename the file or restart Explorer. |
| A song cannot be played | The file may be missing or damaged; the app skips to the next song and shows a message. |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) – tray, single-instance, dialogs, asset protocol, file associations |
| UI | [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org) |
| Build tool | [Vite 5](https://vitejs.dev) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com) with Material 3 design tokens |
| Design system | Material Design 3 – [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities), [Material Symbols](https://fonts.google.com/icons), `system-ui` font |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Audio | HTML5 `<audio>` + Web Audio API (equalizer, visualizer) on Microsoft Edge WebView2 |
| Rust crates | `tauri`, `tauri-plugin-dialog`, `tauri-plugin-single-instance`, `lofty` (tags & cover art), `walkdir`, `base64`, `serde` |
| Installer | NSIS (via the Tauri bundler) |

## Development

**Prerequisites** – Windows 10 / 11 with WebView2, [Node.js](https://nodejs.org) 18+, [Rust](https://rustup.rs) (stable) with *Desktop development with C++* (Visual Studio Build Tools), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
cd material-music-player
npm install
npm run dev
```

`npm run dev` launches the desktop app (Tauri) with hot reload. The first run compiles the Rust side and takes a few minutes.

| Command | What it does |
|---|---|
| `npm run dev` | Run the desktop app (Tauri) with hot reload |
| `npm run build` | Build the Windows installer |
| `npm run vite:dev` | UI only in a browser (Tauri features are unavailable) |
| `npx tsc --noEmit` | Type-check the frontend |
| `cargo check` (inside `src-tauri`) | Type-check the Rust backend |

**Using it inside an existing Cargo workspace** – add it to the workspace members:

```toml
[workspace]
members = [
  # ...your existing apps...
  "material-music-player/src-tauri",
]
```

| Customization | Where |
|---|---|
| Default theme color | `defaultSettings.seedColor` in `src/lib/types.ts` |
| Add a language | add a dictionary in `src/lib/i18n.ts` (the compiler checks every key is translated) |
| Default window size | `app.windows` in `src-tauri/tauri.conf.json` |
| Supported audio extensions | `AUDIO_EXTS` in `src-tauri/src/lib.rs` and `src/lib/tauri.ts` |

User data: `library.json` (library, playlists, settings, session), `window.json` (window geometry) and `prefs.json` in `%APPDATA%\com.minhtrong67.material-music-player`; cover cache in `%LOCALAPPDATA%\com.minhtrong67.material-music-player\covers`.

## Build

```bash
npm install
npm run build
```

| Artifact | Path (project inside a Cargo workspace → `target` at the workspace root) |
|---|---|
| Installer | `target/release/bundle/nsis/Material Music Player_1.0.0_x64-setup.exe` |
| Portable executable | `target/release/material-music-player.exe` |

- The first build downloads the NSIS tooling, so an internet connection is required.
- To change the version, edit `version` in both `package.json` and `src-tauri/tauri.conf.json`.
- The installer is not code-signed – see the [Tauri signing guide](https://tauri.app/distribute/sign/windows/).

**Icons** – the app icon, the setup (installer) icon and the uninstall icon share the same artwork and ship with every standard Windows display size:

| File | Used for | Sizes |
|---|---|---|
| `src-tauri/icons/icon.ico` | app, taskbar, Explorer, window | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `src-tauri/icons/installer.ico` | setup `.exe` **and** `uninstall.exe` | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` (256), `256x256.png`, `icon.png` (512) | Tauri / bundler / high-DPI | as named |

To use your own artwork replace `src-tauri/icons/icon.png` (square, ≥ 512 px), run `npx tauri icon src-tauri/icons/icon.png`, and keep all the standard sizes in `installer.ico`.

## Project Structure

```
material-music-player/
├─ screenshot/                README screenshots (image01.png … image05.png)
├─ public/                    static assets (logo used by the UI)
├─ src/                       React + TypeScript + Tailwind frontend
│  ├─ main.tsx, App.tsx       entry point, layout, global shortcuts, drag & drop, theme
│  ├─ index.css               Material 3 tokens, motion, sliders
│  ├─ lib/
│  │  ├─ store.ts             application state (zustand): library, queue, playback, settings
│  │  ├─ audio.ts             <audio> engine, equalizer, spectrum
│  │  ├─ i18n.ts              English / Vietnamese dictionaries
│  │  ├─ theme.ts             Material 3 palette generation from a seed color
│  │  ├─ cover.ts, lrc.ts, m3u.ts, menus.ts
│  │  └─ tauri.ts, window.ts, types.ts, utils.ts
│  ├─ components/             TitleBar, NavDrawer, PlayerBar, NowPlaying, QueuePanel, MiniPlayer,
│  │                          Collection, TrackRow, TrackListView, MediaCard, Dialogs, ui (M3 kit) …
│  └─ views/                  Library (home, songs, albums, artists, playlists, search), Settings
├─ src-tauri/                 Rust backend
│  ├─ src/lib.rs              commands: scan, tags & covers, lyrics, state, tray, window memory
│  ├─ src/main.rs
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

Designed and developed by **minhtrong67** with the support of the AI assistant **Claude** (Anthropic). Built with [Tauri](https://tauri.app), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Zustand](https://zustand-demo.pmnd.rs), [Material Color Utilities](https://github.com/material-foundation/material-color-utilities), [Material Symbols](https://fonts.google.com/icons) and [lofty](https://crates.io/crates/lofty).
