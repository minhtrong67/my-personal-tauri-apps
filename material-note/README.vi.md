<div align="center">

<img src="src/assets/logo.svg" alt="Material Note logo" width="120" height="120">

# Material Note

**Ứng dụng ghi chú nhanh, nhiều thẻ, thiết kế Material Design 3 — xây dựng bằng Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)
![Author](https://img.shields.io/badge/Tác giả-minhtrong67-6750A4)
![AI](https://img.shields.io/badge/AI-Claude-D97757)

</div>

---

## Giới thiệu

Material Note là ứng dụng ghi chú desktop gọn nhẹ, lấy cảm hứng từ Notepad của Windows nhưng được thiết kế lại theo phong cách **Material Design 3** của Google. Ứng dụng khởi động nhanh, tốn ít bộ nhớ (Tauri + WebView của hệ thống) và không làm phiền bạn khi viết.

## Ảnh chụp màn hình

<p align="center">
  <img src="screenshots/image01.png" alt="Material Note - light theme" width="49%">
  <img src="screenshots/image02.png" alt="Material Note - dark theme" width="49%">
</p>
<p align="center">
  <img src="screenshots/image03.png" alt="Material Note - find and replace" width="49%">
  <img src="screenshots/image04.png" alt="Material Note - settings" width="49%">
</p>

## Tính năng

| Nhóm | Nội dung |
| --- | --- |
| **Tài liệu** | Nhiều thẻ (ngang hoặc dọc), Mới / Mở (chọn nhiều tệp) / Lưu / Lưu thành, hỏi lưu theo từng thẻ và khi thoát, kéo thả tệp, mở lại tệp khi khởi động, mở từ dòng lệnh hoặc “Mở bằng”, In |
| **Soạn thảo** | Hoàn tác / làm lại, cắt / sao chép / dán, đi tới dòng, chèn giờ & ngày (`F5`), đổi CRLF ⇄ LF, kiểm tra chính tả tuỳ chọn |
| **Tìm & thay thế** | Tìm tiếp / trước, thay thế, thay tất cả, phân biệt hoa thường, cả từ (hỗ trợ Unicode), biểu thức chính quy, **tô sáng mọi kết quả**, bộ đếm “3 / 12” trực tiếp |
| **Xem** | Thu phóng (`Ctrl` + lăn chuột / `+` / `-` / `0`), tự xuống dòng, thanh trạng thái (dòng, cột, số ký tự, thu phóng, mã hoá, kiểu xuống dòng), phông system-ui / đơn cách / có chân và cỡ chữ tuỳ chỉnh, toàn màn hình (`F11`) |
| **Cửa sổ** | **Tuỳ chọn cửa sổ** trong Cài đặt: *ghi nhớ kích thước cửa sổ* (mở lại đúng kích thước bạn đã chỉnh lần trước) hoặc *luôn mở ở chế độ phóng to tối đa* |
| **Giao diện** | Sáng / tối / theo hệ thống, **màu chủ đề tuỳ chỉnh** (màu có sẵn + bộ chọn màu), phông system-ui, chuyển động kiểu Material (ripple, chuyển cảnh hộp thoại và menu; tôn trọng cài đặt giảm chuyển động) |
| **Ngôn ngữ** | Tiếng Anh và Tiếng Việt, đổi ngay khi đang chạy; tự nhận diện ở lần mở đầu tiên |
| **Đóng gói** | Icon ứng dụng, icon cài đặt và **icon gỡ cài đặt** cùng hình cho bộ cài NSIS / MSI, đều theo phong cách Material 3 |

### Phím tắt

| Thao tác | Phím tắt | Thao tác | Phím tắt |
| --- | --- | --- | --- |
| Thẻ mới | `Ctrl+N` | Tìm kiếm | `Ctrl+F` |
| Mở | `Ctrl+O` | Thay thế | `Ctrl+H` |
| Lưu | `Ctrl+S` | Tìm tiếp / trước | `F3` / `Shift+F3` |
| Lưu thành | `Ctrl+Shift+S` | Đi tới dòng | `Ctrl+G` |
| Đóng thẻ | `Ctrl+W` | Giờ / ngày | `F5` |
| Thẻ kế / trước | `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cài đặt | `Ctrl+,` |
| In | `Ctrl+P` | Toàn màn hình | `F11` |

## Tải về

Tải bộ cài Windows mới nhất (`Material Note_x.y.z_x64-setup.exe`) tại trang **[Releases](https://github.com/minhtrong67/material-note/releases/latest)** Releases.

## Cài đặt

1. Tải và chạy bộ cài — cài cho người dùng hiện tại, không cần quyền quản trị.
2. Mở **Material Note** từ menu Start.
3. Để gỡ cài đặt, dùng *Settings → Apps* (hoặc chạy trình gỡ cài đặt trong thư mục cài).

## Công nghệ sử dụng

| Lớp | Công nghệ |
| --- | --- |
| Khung ứng dụng | [Tauri 2](https://tauri.app) |
| Backend | Rust — [`tauri-plugin-dialog`](https://crates.io/crates/tauri-plugin-dialog) |
| Giao diện | HTML / CSS / JavaScript thuần (không cần bundler) |
| Thiết kế | Material Design 3 (bảng màu OKLCH sinh từ một màu gốc) |
| Công cụ | npm (Tauri CLI), Python + Pillow (tạo icon) |

## Phát triển

Yêu cầu:

- [Rust](https://rustup.rs) 1.77+
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (Windows: Microsoft C++ Build Tools và WebView2)
- [Node.js](https://nodejs.org) (npm)

```bash
cd material-note

npm install        # một lần: cài Tauri CLI
npm run dev        # chạy chế độ phát triển
```

Dự án được thiết kế để nằm trong Cargo workspace (`members = ["*/src-tauri"]`) và dùng chung thư mục `target/`. Nếu muốn dùng riêng lẻ, thêm bảng `[workspace]` rỗng vào `src-tauri/Cargo.toml`.

Để tạo lại toàn bộ icon (ứng dụng, cài đặt, gỡ cài đặt, hình NSIS / MSI): `pip install pillow` rồi `python tools/generate_icons.py`.

## Build

```bash
npm run build
```

Bộ cài nằm trong `<workspace>/target/release/bundle/` (`nsis/` cho file `.exe`, `msi/` cho file `.msi`).

> **Icon.** Icon ứng dụng, icon cài đặt và **icon gỡ cài đặt riêng** (`uninstallerIcon`, Tauri 2.9+) đều theo phong cách Material 3 — file `.ico` có đủ kích thước chuẩn 16 – 256 px, cùng PNG 32 / 128 / 256 / 512 px.

## Cấu trúc dự án

```
material-note/
├── screenshots/              # image01.png, image02.png, ... used by this README
├── src/                      # Giao diện (HTML / CSS / JS thuần, không cần bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Màu gốc → bảng màu M3, sáng/tối/hệ thống
│   ├── boot.js               # Áp dụng theme đã lưu trước lần vẽ đầu tiên
│   ├── i18n.js               # Chuỗi tiếng Anh + tiếng Việt
│   ├── app.js                # Thẻ, tệp, tìm/thay thế, menu, cài đặt
│   └── assets/logo.svg
├── src-tauri/                # Backend Rust
│   ├── src/main.rs           # Lệnh đọc/ghi tệp
│   ├── tauri.conf.json       # Cửa sổ, đóng gói, trình cài đặt
│   ├── capabilities/         # Quyền của Tauri
│   └── icons/                # Icon ứng dụng + installer/ (icon cài đặt & gỡ cài đặt, hình ảnh)
├── tools/generate_icons.py   # Tạo lại toàn bộ icon bằng code
├── package.json
├── LICENSE
└── README.md
```

### Giới hạn

- Tệp được đọc/ghi dạng UTF-8 (BOM bị bỏ; byte không hợp lệ được thay thế).
- Lịch sử hoàn tác tính riêng từng thẻ và mất khi đóng thẻ.
- Màu sắc dùng `oklch()` và `color-mix()`, cần WebView2 / WebKit đủ mới.

## Ghi công

Tác giả: **minhtrong67** với sự hỗ trợ của trợ lý AI **Claude** ([Anthropic](https://www.anthropic.com)).

## Giấy phép

Phát hành theo [MIT License](LICENSE).
