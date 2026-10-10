<div align="center">

<img src="src/assets/logo.svg" alt="Material File logo" width="120" height="120">

# Material File

**Trình quản lý tệp đơn giản, nhanh, lấy cảm hứng từ File Explorer của Windows 11, thiết kế theo Material Design 3 — xây dựng bằng Tauri.**

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

Material File giữ lại những phần của File Explorer mà bạn dùng hằng ngày — truy cập nhanh, ổ đĩa, thẻ thư mục, breadcrumb, chế độ xem chi tiết và biểu tượng, sao chép / cắt / dán, đổi tên, thùng rác, tìm kiếm và ngăn chi tiết — và lược bỏ phần còn lại. Ứng dụng khởi động nhanh, tốn ít bộ nhớ (Tauri + WebView của hệ thống) và theo phong cách **Material Design 3** của Google.

## Ảnh chụp màn hình

<p align="center">
  <img src="screenshots/image01.png" alt="Material File - light theme" width="49%">
  <img src="screenshots/image02.png" alt="Material File - dark theme" width="49%">
</p>
<p align="center">
  <img src="screenshots/image03.png" alt="Material File - icon view and details pane" width="49%">
  <img src="screenshots/image04.png" alt="Material File - context menu and settings" width="49%">
</p>

## Tính năng

| Nhóm | Nội dung |
| --- | --- |
| **Điều hướng** | **Trang chủ** như Windows 11 (thẻ truy cập nhanh, thư mục thường dùng, tệp gần đây, ổ đĩa), quay lại / tiến tới / lên / làm mới (chuột phải vào nút quay lại / tiến tới để xem **lịch sử**; **nút Back / Forward bên hông chuột** hoạt động, kể cả chuột chơi game), thanh địa chỉ breadcrumb gõ trực tiếp được (bấm `›` để nhảy vào thư mục con), **cây thư mục** ở thanh bên (chỉ mở khi bạn bấm mũi tên; có tuỳ chọn tự mở tới thư mục hiện tại), thư mục đã ghim, *Máy tính này* với thanh dung lượng ổ đĩa, lối tắt Thùng rác, **thẻ thư mục** (`Ctrl+T`, nhấn chuột giữa vào thư mục) |
| **Chế độ xem** | Chi tiết với **cột kéo giãn và bật / tắt được** (tên, ngày sửa đổi, ngày tạo, loại, kích thước), biểu tượng nhỏ / vừa / lớn có ảnh thu nhỏ, **Nhóm theo** (tên, loại, ngày sửa đổi, kích thước), **bộ lọc loại tệp**, **ô chọn mục** tuỳ chọn, **ngăn chi tiết** tuỳ chọn (xem trước ảnh và văn bản, `Alt+P`), bật / tắt mục ẩn và đuôi tên tệp |
| **Thao tác tệp** | Tạo thư mục / văn bản / Markdown / JSON / HTML / CSV, cắt, sao chép, dán với hộp thoại xử lý trùng tên **Thay thế / Bỏ qua / Giữ cả hai**, đổi tên ngay trên dòng (`F2`) và **đổi tên hàng loạt**, xoá vào Thùng rác hoặc xoá vĩnh viễn, **hoàn tác** (`Ctrl+Z`), kéo thả để di chuyển (giữ `Ctrl` để sao chép), chọn bằng cách kéo khung, và **thẻ tiến trình có nút Huỷ** cho thao tác sao chép / di chuyển lâu |
| **Menu chuột phải** | Menu kiểu Windows cho tệp, thư mục, thanh bên và vùng trống: *Mở*, *Mở trong thẻ mới*, **Mở trong Terminal**, **Mở bằng Code**, *Mở bằng* (Notepad, WinRAR), *Hiện trong File Explorer*, *Ghim vào Truy cập nhanh*, **Sao chép dưới dạng đường dẫn**, cắt / sao chép / đổi tên / xoá, *Thuộc tính*, *Đặt làm hình nền* cho ảnh, *Mở trong cửa sổ mới*, cùng menu con Xem / Sắp xếp theo / Mới |
| **Tệp nén** | **Giải nén tại đây / vào thư mục** và **Nén thành ZIP / RAR** bằng **WinRAR** khi đã cài (dự phòng 7-Zip, rồi PowerShell / `tar` cho ZIP) |
| **Đường dẫn** | Đường dẫn dài không còn tràn: thanh địa chỉ luôn hiện các thư mục sâu nhất, hộp thoại tự xuống dòng, và có **nút sao chép đường dẫn** ở thanh địa chỉ và hộp thoại Thuộc tính |
| **Tìm kiếm** | Lọc tức thì khi gõ; nhấn `Enter` để tìm trong thư mục hiện tại và mọi thư mục con |
| **Cửa sổ** | **Tuỳ chọn cửa sổ** trong Cài đặt: *ghi nhớ kích thước cửa sổ* (mở lại đúng kích thước bạn đã chỉnh lần trước) hoặc *luôn mở ở chế độ phóng to tối đa*; `F11` bật / tắt toàn màn hình; mở thêm cửa sổ bằng `Ctrl+N` |
| **Giao diện** | Sáng / tối / theo hệ thống, **màu chủ đề tuỳ chỉnh** (màu có sẵn + bộ chọn màu), phông system-ui, chuyển động kiểu Material (ripple, chuyển cảnh hộp thoại và menu; tôn trọng cài đặt giảm chuyển động) |
| **Ngôn ngữ** | Tiếng Anh và Tiếng Việt, đổi ngay khi đang chạy; tự nhận diện ở lần mở đầu tiên |
| **Đóng gói** | Icon ứng dụng, icon trình cài đặt, icon gỡ cài đặt cùng hình cho bộ cài NSIS / MSI, đều theo phong cách Material 3 |

### Phím tắt

| Thao tác | Phím tắt | Thao tác | Phím tắt |
| --- | --- | --- | --- |
| Mở | `Enter` | Cắt / Sao chép / Dán | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` |
| Lùi / Tiến / Lên | `Backspace` / `Alt+←` / `Alt+→` / `Alt+↑`, nút bên hông chuột | Sao chép đường dẫn | `Ctrl+Shift+C` |
| Thanh địa chỉ | `Ctrl+L` / `Alt+D` | Hoàn tác | `Ctrl+Z` |
| Tìm kiếm | `Ctrl+F` | Đổi tên | `F2` |
| Thẻ mới / Đóng thẻ / Thẻ kế | `Ctrl+T` / `Ctrl+W` / `Ctrl+Tab` | Xoá / xoá vĩnh viễn | `Del` / `Shift+Del` |
| Thư mục mới | `Ctrl+Shift+N` | Thuộc tính | `Alt+Enter` |
| Xem chi tiết / biểu tượng | `Ctrl+1` / `Ctrl+2` | Ngăn chi tiết | `Alt+P` |
| Làm mới | `F5` | Toàn màn hình | `F11` |
| Cửa sổ mới | `Ctrl+N` | Đổi tên hàng loạt (chọn nhiều mục) | `F2` |
| Cài đặt | `Ctrl+,` | Xoá tìm kiếm hoặc bỏ chọn | `Esc` |

## Tải về

Tải bộ cài Windows mới nhất (`Material File_x.y.z_x64-setup.exe`) tại trang **[Releases](https://github.com/minhtrong67/material-file/releases/latest)** Releases.

## Cài đặt

1. Tải và chạy bộ cài — cài cho người dùng hiện tại, không cần quyền quản trị.
2. Mở **Material File** từ menu Start.
3. Tuỳ chọn: cài [WinRAR](https://www.win-rar.com) để giải nén / nén RAR, 7z, ZIP và [VS Code](https://code.visualstudio.com) (có `code` trong `PATH`) cho **Mở bằng Code**.

## Công nghệ sử dụng

| Lớp | Công nghệ |
| --- | --- |
| Khung ứng dụng | [Tauri 2](https://tauri.app) |
| Backend | Rust — [`trash`](https://crates.io/crates/trash), [`sysinfo`](https://crates.io/crates/sysinfo), [`open`](https://crates.io/crates/open), [`dirs`](https://crates.io/crates/dirs) |
| Giao diện | HTML / CSS / JavaScript thuần (không cần bundler) |
| Thiết kế | Material Design 3 (bảng màu OKLCH sinh từ một màu gốc) |
| Công cụ | npm (Tauri CLI), Python + Pillow (tạo icon) |

## Phát triển

Yêu cầu:

- [Rust](https://rustup.rs) 1.77+
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (Windows: Microsoft C++ Build Tools và WebView2)
- [Node.js](https://nodejs.org) (npm)

```bash
cd material-file

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
material-file/
├── screenshots/              # image01.png, image02.png, ... used by this README
├── src/                      # Giao diện (HTML / CSS / JS thuần, không cần bundler)
│   ├── index.html
│   ├── styles.css            # Material Design 3 tokens and components
│   ├── theme.js              # Màu gốc → bảng màu M3, sáng/tối/hệ thống
│   ├── boot.js               # Áp dụng theme đã lưu trước lần vẽ đầu tiên
│   ├── i18n.js               # Chuỗi tiếng Anh + tiếng Việt
│   ├── app.js                # Điều hướng, thẻ, danh sách, chọn mục, menu, thao tác tệp
│   └── assets/logo.svg
├── src-tauri/                # Backend Rust
│   ├── src/main.rs           # lệnh liệt kê / tìm / sao chép / di chuyển / đổi tên / thùng rác / ổ đĩa / tệp nén / công cụ
│   ├── tauri.conf.json       # Cửa sổ, đóng gói, trình cài đặt
│   ├── capabilities/         # Quyền của Tauri
│   └── icons/                # Icon ứng dụng + installer/ (icon cài đặt & gỡ cài đặt, hình ảnh)
├── tools/generate_icons.py   # Tạo lại toàn bộ icon bằng code
├── package.json
├── LICENSE
└── README.md
```

### Giới hạn

- Cắt / sao chép / dán hoạt động trong phạm vi ứng dụng; không trao đổi tệp với clipboard hệ thống hay ứng dụng khác.
- Khi dán trùng tên, ứng dụng hỏi bạn thay thế, bỏ qua hay giữ cả hai (đặt tên như `file (2).txt`).
- Hoàn tác áp dụng cho đổi tên, tạo mới, sao chép / dán, di chuyển và nén — không áp dụng cho xoá (hãy khôi phục từ Thùng rác).
- *Thay thế* trong hộp thoại trùng tên sẽ xoá hẳn mục cũ (không vào Thùng rác).
- Màu sắc dùng `oklch()` và `color-mix()`, cần WebView2 / WebKit đủ mới.

## Ghi công

Tác giả: **minhtrong67** với sự hỗ trợ của trợ lý AI **Claude** ([Anthropic](https://www.anthropic.com)).

## Giấy phép

Phát hành theo [MIT License](LICENSE).
