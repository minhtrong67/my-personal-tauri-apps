<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="128" alt="Material Docx logo" />

# Material Docx

**A simple, beautiful word processor with `.docx` support — built with Tauri and Material Design 3.**

[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Material Design 3](https://img.shields.io/badge/Material%20Design-3-6750A4)](https://m3.material.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

English · [Tiếng Việt](#tiếng-việt)

</div>

---

## Overview

Material Docx is a lightweight desktop word processor in the spirit of Microsoft Word, stripped down to what you use every day. It opens and saves real `.docx` files, follows your system's light/dark setting, and lets you recolor the whole interface from a single accent color. The installer is small, the app starts fast, and the UI is available in **English** and **Vietnamese**.

## Features

| Area | What you get |
| --- | --- |
| **Documents** | New / Open / Save / Save as, `.docx` import & export, also open/save `.html` and `.txt`, auto-saved draft recovery, "Open with" and drag & drop |
| **Text** | Bold, italic, underline, strikethrough, super/subscript, font family, font size, text color, highlight, clear formatting |
| **Paragraphs** | Headings 1–3, quote, alignment (left/center/right/justify), bulleted & numbered lists with nesting, indent/outdent, line spacing |
| **Insert** | Tables (add/remove rows and columns), images (insert, paste, drag in, resize), hyperlinks, horizontal rule |
| **Page** | A4 / Letter / A5, portrait / landscape, four margin presets (saved into the `.docx`) |
| **Tools** | Find & replace (match case, replace all), live word/character/page count, zoom 50–200 % (Ctrl + wheel), print / export to PDF |
| **Design** | Material Design 3, system UI font, light / dark / system theme, custom accent color with a generated tonal palette, smooth motion (ripples, animated dialogs, theme cross-fade; respects *reduce motion*) |
| **Languages** | English and Vietnamese, switchable at runtime (or automatic) |

### Keyboard shortcuts

| Shortcut | Action | Shortcut | Action |
| --- | --- | --- | --- |
| `Ctrl+N` | New document | `Ctrl+B / I / U` | Bold / Italic / Underline |
| `Ctrl+O` | Open | `Ctrl+Z / Y` | Undo / Redo |
| `Ctrl+S` | Save | `Ctrl+F` | Find & replace |
| `Ctrl+Shift+S` | Save as | `Ctrl+K` | Insert link |
| `Ctrl+P` | Print / PDF | `Ctrl+` `+` `-` `0` | Zoom in / out / reset |

(On macOS use `⌘` instead of `Ctrl`.)

## Theming

Material Docx implements a Material You–style dynamic color system. Pick one of the preset swatches or any custom color in **Settings → Accent color**; the app derives the full set of Material 3 color roles (primary, secondary, tertiary, surface containers, outline…) for both light and dark schemes from that seed. **Light**, **Dark** and **System** modes are available from Settings, and the toolbar sun/moon button cycles through them.

## Install

Pre-built installers are produced by `tauri build` (see below):

* **Windows** – NSIS setup (`.exe`) with a branded installer icon, sidebar and header artwork, an uninstaller icon, and English/Vietnamese installer languages.
* **macOS** – `.dmg` / `.app`
* **Linux** – `.deb`, `.rpm`, `.AppImage`

## Build from source

### Prerequisites

* [Rust](https://rustup.rs) (stable) and the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your OS
  (Linux: `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2`, build tools)
* [Node.js](https://nodejs.org) 18+ (only used to run the Tauri CLI)

### Commands

```bash
cd material-docx
npm install            # installs the Tauri CLI
npm run dev            # run in development mode
npm run build          # produce installers in ../target/release/bundle
```

This project lives in a Cargo **workspace** (`*/src-tauri`), so all projects share one build cache in `../target`.

### Regenerating icons

All icons (app icon, installer icon, uninstaller icon, NSIS sidebar/header bitmaps) are drawn procedurally in Material 3 style:

```bash
pip install pillow
npm run icons          # python3 tools/make-icons.py
```

## Project structure

```
material-docx/
├── src/                    # Front-end (no bundler, plain ES modules)
│   ├── index.html          # UI markup
│   ├── style.css           # Material Design 3 styles
│   ├── theme.js            # Tonal palette + light/dark/system theming
│   ├── i18n.js             # English / Vietnamese strings
│   ├── app.js              # Editor logic, file I/O, settings
│   ├── docx.js             # .docx reader/writer (WordprocessingML)
│   └── zip.js              # Minimal ZIP implementation
├── src-tauri/              # Rust shell
│   ├── src/main.rs         # File commands (read/write/initial file)
│   ├── tauri.conf.json     # Window, bundle & installer configuration
│   ├── capabilities/       # Tauri permissions
│   └── icons/              # App / installer / uninstaller icons
└── tools/make-icons.py     # Icon generator
```

## Limitations

Material Docx intentionally keeps things simple. When opening complex Word files, features such as headers/footers, footnotes, text boxes, tracked changes, comments, equations and floating images are not preserved. The editor shows the document as one continuous sheet; print/PDF export uses the browser engine's pagination.

## Credits

Created by **minhtrong67** with the assistance of **Claude** (AI by [Anthropic](https://www.anthropic.com)).

## License

Released under the [MIT License](LICENSE).

---

<a id="tiếng-việt"></a>

## Tiếng Việt

<div align="center">

**Trình soạn thảo văn bản đơn giản, đẹp mắt, hỗ trợ `.docx` — xây dựng bằng Tauri và Material Design 3.**

</div>

### Giới thiệu

Material Docx là ứng dụng soạn thảo văn bản nhẹ cho máy tính, lấy cảm hứng từ Microsoft Word nhưng chỉ giữ lại những gì bạn dùng hằng ngày. Ứng dụng mở và lưu tệp `.docx` thật, tự theo giao diện sáng/tối của hệ thống và cho phép đổi toàn bộ màu giao diện chỉ từ một màu chủ đề. Bộ cài nhỏ gọn, khởi động nhanh, giao diện có **tiếng Anh** và **tiếng Việt**.

### Tính năng

* **Tài liệu:** Mới / Mở / Lưu / Lưu thành, nhập & xuất `.docx`, mở/lưu thêm `.html` và `.txt`, tự lưu bản nháp để khôi phục, "Mở bằng" và kéo-thả tệp.
* **Văn bản:** in đậm, nghiêng, gạch chân, gạch ngang, chỉ số trên/dưới, phông chữ, cỡ chữ, màu chữ, tô sáng, xóa định dạng.
* **Đoạn văn:** Tiêu đề 1–3, trích dẫn, căn lề (trái/giữa/phải/đều), danh sách đầu dòng và đánh số nhiều cấp, thụt lề, giãn dòng.
* **Chèn:** bảng (thêm/xóa hàng, cột), hình ảnh (chèn, dán, kéo-thả, đổi kích thước), liên kết, đường kẻ ngang.
* **Trang:** A4 / Letter / A5, dọc / ngang, bốn mức lề (được lưu vào `.docx`).
* **Công cụ:** tìm & thay thế, đếm từ/ký tự/trang trực tiếp, thu phóng 50–200 % (Ctrl + lăn chuột), in / xuất PDF.
* **Thiết kế:** Material Design 3, phông chữ system-ui, giao diện sáng / tối / theo hệ thống, màu chủ đề tùy chỉnh với bảng màu được sinh tự động.
* **Ngôn ngữ:** tiếng Anh và tiếng Việt, đổi ngay trong ứng dụng (hoặc tự động).

### Phím tắt

`Ctrl+N` mới · `Ctrl+O` mở · `Ctrl+S` lưu · `Ctrl+Shift+S` lưu thành · `Ctrl+P` in/PDF · `Ctrl+F` tìm & thay · `Ctrl+K` chèn liên kết · `Ctrl` + `+` / `-` / `0` thu phóng.

### Màu chủ đề

Vào **Cài đặt → Màu chủ đề**, chọn một màu có sẵn hoặc màu tùy ý; Material Docx sẽ tự sinh đầy đủ các vai trò màu của Material 3 cho cả chế độ sáng và tối. Nút mặt trời/mặt trăng trên thanh tiêu đề dùng để chuyển nhanh giữa **Sáng**, **Tối** và **Hệ thống**.

### Cài đặt & build

```bash
cd material-docx
npm install            # cài Tauri CLI
npm run dev            # chạy chế độ phát triển
npm run build          # tạo bộ cài trong ../target/release/bundle
npm run icons          # tạo lại toàn bộ icon (cần: pip install pillow)
```

Yêu cầu: Rust (stable), Node.js 18+ và các [thành phần phụ thuộc của Tauri 2](https://tauri.app/start/prerequisites/) theo hệ điều hành. Dự án nằm trong **Cargo workspace** (`*/src-tauri`) nên dùng chung một bộ nhớ đệm build tại `../target`.

Trên Windows, trình cài đặt NSIS có icon cài đặt, ảnh sidebar/header, icon gỡ cài đặt theo phong cách Material và hỗ trợ tiếng Anh/tiếng Việt.

### Hạn chế

Material Docx cố ý giữ sự đơn giản: khi mở tệp Word phức tạp, các tính năng như đầu/chân trang, chú thích cuối trang, hộp văn bản, theo dõi thay đổi, bình luận, công thức và hình nổi sẽ không được giữ lại.

### Tác giả

Tạo bởi **minhtrong67** với sự hỗ trợ của AI **Claude** (Anthropic).

### Giấy phép

Phát hành theo [Giấy phép MIT](LICENSE).
