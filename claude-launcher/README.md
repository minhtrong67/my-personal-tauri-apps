<div align="center">

<img src="src-tauri/icons/icon.png" width="96" alt="Claude Launcher icon" />

# Claude Launcher

**Open and close your Chrome profiles in one click, straight into a new Claude chat.**

![Author](https://img.shields.io/badge/author-minhtrong67-9aa5ff?style=for-the-badge)
![AI](https://img.shields.io/badge/built%20with%20AI-Claude-6fd6b0?style=for-the-badge)

![Tauri](https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

English · [Tiếng Việt](README.vi.md)

</div>

Created by **minhtrong67** with the help of the AI assistant **Claude**.

## Introduction

If you keep several Chrome profiles (work, personal, media, backup...), signing in to each one and opening the same page gets repetitive. **Claude Launcher** reads your Chrome profile list, then opens any profile, or many at once, directly on `https://claude.ai/new`. It can also close them again, and shows which profiles are running right now.

It is a small native app: a Rust backend with a React interface, around a few MB on disk.

## Screenshots

<table>
  <tr>
    <td><img src="screenshots/image01.png" alt="Dark theme, Vietnamese" /></td>
    <td><img src="screenshots/image02.png" alt="Light theme, English, multi-select" /></td>
  </tr>
  <tr>
    <td><img src="screenshots/image03.png" alt="Settings panel, dark" /></td>
    <td><img src="screenshots/image04.png" alt="Settings panel, light, Vietnamese" /></td>
  </tr>
</table>

> The screenshots are renders of the real interface with sample profiles.

## Features

- **Open fast.** Click a profile to open it on the destination page. Select several and open them together, or open all.
- **Close profiles.** Close one profile, a selection, or everything that is running. Chrome receives the normal "close window" request, so it can restore your tabs next time.
- **Live status.** A green dot and a "Running" badge show which profiles are open; the list refreshes itself while the app is visible.
- **Any destination.** The default is `https://claude.ai/new`, but you can point it to any `http(s)` address. It is remembered.
- **Search and shortcuts.** Filter by name or email. `Ctrl+F` focuses search, `Ctrl+A` selects all, `Esc` clears search, selection or closes settings.
- **Light, dark or system theme**, with a smooth transition. The native title bar follows the theme.
- **English and Vietnamese**, switchable at any time.
- **Window behavior.** Choose to *remember the size* you last dragged the window to, or to *always open maximized*.
- **Polished and light.** Staggered list animations, skeleton loading, profile photos loaded on demand, and reduced-motion support.
- **Branded installer.** App, setup and uninstall icons in standard Windows sizes, plus installer artwork, with a Vietnamese and English setup wizard.

## Installation

### Requirements

- Windows 10 or 11 (Chrome profile closing is Windows-only; opening works on macOS and Linux too)
- Google Chrome
- Microsoft Edge WebView2 Runtime (already included in Windows 11)

### Install from the setup file

1. Build the installer (see [Build](#build)) or download it from your releases.
2. Run `Claude Launcher_0.1.0_x64-setup.exe`. It installs for the current user, no administrator rights needed.
3. Start **Claude Launcher** from the Start menu.

Prefer no installer? Copy `target/release/claude-launcher.exe` anywhere and run it.

> Each profile must already be signed in to Claude to land directly in the chat.

## Tech stack

| Layer | Technology |
| --- | --- |
| Shell | [Tauri 2](https://tauri.app) (Rust) |
| Interface | React 18, Vite 6 |
| Styling | Plain CSS with design tokens, light and dark themes |
| Backend | Rust, `serde_json`, direct Win32 calls (`user32`, `kernel32`) |
| Installer | NSIS, per-user install |

## Development

Prerequisites: [Node.js](https://nodejs.org) 18+, [Rust](https://rustup.rs) (stable) and the [Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/) (Microsoft C++ Build Tools).

```bash
npm install     # install dependencies
npm run dev     # start the app in development mode with hot reload
```

This project lives in a Cargo workspace (`members = ["*/src-tauri"]`), so Rust builds share the workspace `target` folder.

## Build

```bash
npm run build
```

Outputs, relative to the workspace root:

- `target/release/claude-launcher.exe` — portable executable
- `target/release/bundle/nsis/` — installer

If Chrome is installed somewhere unusual, adjust `chrome_path()` in `src-tauri/src/main.rs`.

### How closing works

The app tracks the Chrome windows it opens, and also recognizes windows whose title ends with the profile name (Chrome shows it when you use several profiles). Only windows belonging to `chrome.exe` are touched.

## Project structure

```
claude-launcher/
├── src/
│   ├── components/
│   │   ├── Avatar.jsx          # profile photo with initials fallback
│   │   ├── Icons.jsx           # logo and icons
│   │   ├── Row.jsx             # one profile row
│   │   └── SettingsPanel.jsx   # language, theme, window options
│   ├── App.jsx                 # main screen and logic
│   ├── i18n.js                 # English and Vietnamese strings
│   ├── main.jsx                # entry point
│   ├── settings.js             # persisted settings
│   ├── styles.js               # CSS (light and dark)
│   └── tauri.js                # Tauri API wrapper
├── src-tauri/
│   ├── capabilities/           # window permissions
│   ├── icons/                  # app, setup and uninstall icons, installer images
│   ├── src/main.rs             # list, open, close and detect profiles
│   ├── Cargo.toml
│   └── tauri.conf.json
├── screenshots/                # image01.png ... image04.png
├── index.html
├── package.json
├── vite.config.js
├── LICENSE
└── README.md
```

## License

Released under the [MIT License](LICENSE). Copyright © 2026 **minhtrong67**.

---

<div align="center">

Made by **minhtrong67** · with the help of AI **Claude**

</div>
