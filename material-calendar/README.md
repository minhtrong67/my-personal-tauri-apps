<div align="center">

<img src="src-tauri/icons/128x128.png" width="96" alt="Material Calendar logo" />

# Material Calendar

**A fast, beautiful desktop calendar — Material Design 3, built with Tauri 2.**

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Material Design 3](https://img.shields.io/badge/Material%20Design-3-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)

English · [Tiếng Việt](#tiếng-việt)

</div>

## Introduction

**Material Calendar** is a lightweight, offline-first desktop app for planning your days. It follows Material Design 3, uses your system UI font, adapts to light/dark mode and your favourite theme colour, and ships as a tiny native installer thanks to Tauri.

**Author:** [`minhtrong67`](https://github.com/minhtrong67) — built with the help of **Claude** (Anthropic).

## Screenshots

| | | |
|---|---|---|
| ![Month view](screenshots/image01.png) | ![Week view](screenshots/image02.png) | ![Event dialog](screenshots/image03.png) |
| ![Dark theme](screenshots/image04.png) | ![Settings](screenshots/image05.png) | ![Agenda](screenshots/image06.png) |

> Add your own captures to the `screenshots/` folder using the names `image01.png`, `image02.png`, `image03.png`, …

## Features

- **4 views** — Month, Week, Day and Agenda, with a live "now" line and smooth slide transitions.
- **Events** — title, location, description, date, start/end time, all-day, 8 colours, quick create by clicking a day or a time slot.
- **Recurring events** — daily, weekly, monthly, yearly.
- **Reminders** — at start time up to 1 hour before, shown as in-app toasts with a **Snooze 5 min** action.
- **Drag & drop** — move events to another day (month view) or another time slot (week/day view), with undo.
- **Duplicate** events in one click.
- **Import / Export** — back up or move your events as a JSON file via native open/save dialogs.
- **Search** — instant search across titles and descriptions (`Ctrl/⌘ + K`).
- **Undo delete**, upcoming list and mini calendar in the sidebar.
- **Lunar calendar** — Vietnamese lunar dates (with Can Chi year) in every view, plus Tết, Giỗ Tổ Hùng Vương, Trung thu and other lunar festivals.
- **Public holidays (Vietnam)** — optional.
- **Week numbers** and **12h / 24h** time format.
- **System notifications** for reminders (in addition to in-app toasts).
- **Theming** — Light / Dark / System, 8 preset theme colours plus a custom colour picker.
- **Two languages** — English and Tiếng Việt (or follow the system).
- **Window behaviour** — either *remember the last window size* or *always start maximized*.
- **Polish** — ripple effects, animated dialogs, reduced-motion support, optional animation switch.
- **Keyboard shortcuts** — `N` new · `T` today · `M/W/D/A` views · `←/→` navigate.
- **Private by design** — all data stays on your machine (local storage).

## Installation

Download the installer for your platform from the **Releases** page, or build it yourself (see [Build](#build)).

| Platform | Output |
|---|---|
| Windows | `.exe` (NSIS setup, English & Vietnamese) and `.msi` |
| macOS | `.dmg` / `.app` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

## Tech stack

- [Tauri 2](https://tauri.app) (Rust) — native shell
- Tauri plugins: `dialog` and `fs` (import/export), `notification` (reminders)
- [Vite 5](https://vitejs.dev) + vanilla JavaScript (ES modules) — UI
- Material Design 3 tokens generated at runtime from a seed colour
- `system-ui` font stack

## Development

Prerequisites: [Node.js 18+](https://nodejs.org), [Rust](https://rustup.rs) and the [Tauri system dependencies](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run dev
```

This project lives inside a Cargo workspace (`members = ["*/src-tauri"]`), so place the `material-calendar` folder next to the workspace `Cargo.toml`; all projects share the same `./target` cache.

## Build

```bash
npm run build
```

Installers are written to `../target/release/bundle/` (the shared workspace target folder).

To regenerate every icon size from the master artwork:

```bash
npm run icons   # uses app-icon.png (1024×1024)
```

> `icons/installer.ico` is used by the Windows setup **and** its uninstaller (Tauri's NSIS bundler shares one icon). `icons/uninstall.ico` is a badged variant included for custom NSIS templates.

## Project structure

```
material-calendar/
├── index.html
├── package.json
├── vite.config.js
├── app-icon.png            # 1024×1024 master icon
├── public/                 # favicon
├── screenshots/            # image01.png, image02.png, …
├── src/
│   ├── main.js             # views, dialogs, state, events
│   ├── styles.css          # Material Design 3 styles & animations
│   ├── theme.js            # light/dark/system + seed colour tokens
│   ├── lunar.js            # Vietnamese lunar calendar algorithm
│   ├── i18n.js             # English / Vietnamese strings
│   └── window.js           # remember size / start maximized
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    ├── icons/              # app, installer, uninstaller & NSIS images
    └── src/{main.rs, lib.rs}
```

## License

Released under the [MIT License](LICENSE) © 2026 minhtrong67.

---

## Tiếng Việt

**Material Calendar** là ứng dụng lịch desktop nhẹ, chạy offline, thiết kế theo Material Design 3, dùng font `system-ui`, hỗ trợ giao diện sáng/tối/hệ thống và đổi màu chủ đề.

- Bốn chế độ xem: Tháng, Tuần, Ngày, Lịch trình.
- Âm lịch + lễ âm lịch, số tuần, giờ 12/24h, thông báo hệ thống.
- Sự kiện lặp lại, địa điểm, nhắc nhở (báo lại 5 phút), kéo thả, nhân bản, nhập/xuất JSON, tìm kiếm, hoàn tác khi xóa, ngày lễ Việt Nam.
- Tùy chọn cửa sổ: **ghi nhớ kích thước** hoặc **luôn phóng to tối đa**.
- Chạy: `npm install` → `npm run dev` → `npm run build`.

Tác giả: **minhtrong67** · Với sự hỗ trợ của **Claude**.
