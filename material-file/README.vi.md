<div align="center">

<img src="src/assets/logo.svg" alt="Logo Material File" width="120" height="120">

# Material File

**Trình quản lý tệp đơn giản, nhanh, lấy cảm hứng từ File Explorer của Windows 11, thiết kế theo Material Design 3 — xây dựng bằng Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Giới thiệu

Material File giữ lại những phần của File Explorer mà bạn dùng hằng ngày — truy cập nhanh, ổ đĩa,
thanh địa chỉ dạng breadcrumb, chế độ xem chi tiết và biểu tượng, sao chép / cắt / dán, đổi tên,
thùng rác và tìm kiếm — và lược bỏ phần còn lại. Ứng dụng khởi động nhanh, tốn ít bộ nhớ
(Tauri + WebView của hệ thống) và theo phong cách **Material Design 3** của Google.

## Tính năng

| Nhóm | Nội dung |
| --- | --- |
| **Điều hướng** | Quay lại / tiến tới / lên một cấp / làm mới, thanh địa chỉ breadcrumb có thể gõ trực tiếp, truy cập nhanh (Trang chủ, Màn hình nền, Tài liệu, Tải xuống, Hình ảnh, Nhạc, Video), *Máy tính này* với thanh dung lượng ổ đĩa |
| **Chế độ xem** | Chi tiết với các cột sắp xếp được (tên, ngày sửa đổi, loại, kích thước) và biểu tượng lớn có ảnh thu nhỏ; thư mục luôn hiện trước |
| **Thao tác tệp** | Tạo thư mục / tài liệu văn bản, cắt, sao chép, dán, đổi tên ngay trên dòng (`F2`), xoá vào Thùng rác hoặc xoá vĩnh viễn (`Shift+Delete`), kéo thả để di chuyển (giữ `Ctrl` để sao chép), tự đặt tên không trùng khi xung đột |
| **Chọn mục** | Click, `Ctrl`/`Shift` chọn nhiều, `Ctrl+A`, điều hướng đầy đủ bằng bàn phím và gõ chữ để nhảy tới mục |
| **Tìm kiếm** | Lọc tức thì khi gõ; nhấn `Enter` để tìm trong thư mục hiện tại và mọi thư mục con |
| **Chi tiết** | Hộp thoại Thuộc tính (kích thước, nội dung, ngày tháng, thuộc tính) cho một hoặc nhiều mục; thanh trạng thái hiển thị số mục và dung lượng đã chọn |
| **Giao diện** | Sáng / tối / theo hệ thống, **màu chủ đề tuỳ chỉnh** (màu có sẵn + bộ chọn màu), phông system-ui, chuyển động kiểu Material (ripple, chuyển cảnh hộp thoại và menu; tôn trọng cài đặt giảm chuyển động) |
| **Ngôn ngữ** | Tiếng Anh và Tiếng Việt, đổi ngay khi đang chạy; tự nhận diện ở lần mở đầu tiên |
| **Đóng gói** | Icon ứng dụng, icon trình cài đặt, icon gỡ cài đặt cùng hình cho bộ cài NSIS / MSI, đều theo phong cách Material 3 |

### Phím tắt

| Thao tác | Phím tắt | Thao tác | Phím tắt |
| --- | --- | --- | --- |
| Mở | `Enter` | Cắt / Sao chép / Dán | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` |
| Lùi / Tiến / Lên | `Backspace` hoặc `Alt+←` / `Alt+→` / `Alt+↑` | Chọn tất cả | `Ctrl+A` |
| Thanh địa chỉ | `Ctrl+L` hoặc `Alt+D` | Thư mục mới | `Ctrl+Shift+N` |
| Tìm kiếm | `Ctrl+F` | Đổi tên | `F2` |
| Làm mới | `F5` | Xoá / xoá vĩnh viễn | `Del` / `Shift+Del` |
| Xem chi tiết / biểu tượng | `Ctrl+1` / `Ctrl+2` | Thuộc tính | `Alt+Enter` |
| Cài đặt | `Ctrl+,` | Xoá tìm kiếm hoặc bỏ chọn | `Esc` |

## Cấu trúc dự án

```
material-file/
├── src/                      # Giao diện (HTML / CSS / JS thuần, không cần bundler)
│   ├── index.html
│   ├── styles.css            # Token và component Material Design 3
│   ├── theme.js              # Màu gốc → bảng màu M3, sáng/tối/hệ thống
│   ├── boot.js               # Áp dụng theme đã lưu trước lần vẽ đầu tiên
│   ├── i18n.js               # Chuỗi tiếng Anh + tiếng Việt
│   ├── app.js                # Điều hướng, danh sách, chọn mục, thao tác tệp
│   └── assets/logo.svg
├── src-tauri/                # Backend Rust
│   ├── src/main.rs           # Lệnh liệt kê / tìm / sao chép / di chuyển / đổi tên / thùng rác / ổ đĩa
│   ├── tauri.conf.json       # Cửa sổ, đóng gói, trình cài đặt
│   ├── capabilities/         # Quyền của Tauri
│   └── icons/                # Icon ứng dụng + installer/ (icon cài đặt & gỡ cài đặt, hình ảnh)
├── tools/generate_icons.py   # Tạo lại toàn bộ icon bằng code
├── package.json
├── LICENSE
└── README.md
```

## Yêu cầu

- [Rust](https://rustup.rs) 1.77 trở lên
- [Điều kiện tiên quyết của Tauri](https://v2.tauri.app/start/prerequisites/) cho hệ điều hành của bạn
  (Windows: Microsoft C++ Build Tools và WebView2, đã có sẵn trên Windows 10/11)
- [Node.js](https://nodejs.org) (npm) — cài Tauri CLI từ `package.json`
- Tuỳ chọn, để tạo lại icon: Python 3 và `pip install pillow`

## Bắt đầu

```bash
cd material-file

npm install        # một lần: cài Tauri CLI
npm run dev        # chạy chế độ phát triển
npm run build      # build bộ cài đặt
```

Dự án được thiết kế để nằm trong Cargo workspace (`members = ["*/src-tauri"]`) và dùng chung thư mục
`target/`. File build nằm ở `<workspace>/target/release/bundle/`. Nếu muốn dùng riêng lẻ, thêm bảng
`[workspace]` rỗng vào `src-tauri/Cargo.toml`.

> **Về icon gỡ cài đặt.** File `icons/installer/uninstall.ico` đã được tạo sẵn, nhưng mẫu NSIS của Tauri
> dùng chung một `installerIcon` cho cả trình cài đặt và trình gỡ cài đặt.

## Cách hoạt động

Giao diện viết bằng JavaScript thuần. Mọi thao tác với hệ thống tệp nằm trong các lệnh Rust:
`list_dir`, `search_dir`, `paste_items`, `rename_item`, `create_item`, `delete_items`
(qua crate [`trash`](https://crates.io/crates/trash)), `item_properties`, `get_drives`
(qua [`sysinfo`](https://crates.io/crates/sysinfo)) và `open_item` (qua
[`open`](https://crates.io/crates/open)). Ảnh thu nhỏ dùng asset protocol của Tauri.

## Giới hạn

- Cắt / sao chép / dán hoạt động trong phạm vi ứng dụng; không trao đổi tệp với clipboard hệ thống
  hay với ứng dụng khác.
- Dán không bao giờ ghi đè: khi trùng tên, tệp mới được đặt tên duy nhất như `file (2).txt`.
- Danh sách thư mục không ảo hoá (dùng `content-visibility` để giữ mượt); thư mục cực lớn có thể mất
  một lúc để tải.
- Màu sắc dùng `oklch()` và `color-mix()`, cần WebView2 / WebKit đủ mới.

## Ghi công

Tác giả: **minhtrong67**, với sự hỗ trợ của **Claude**, trợ lý AI của [Anthropic](https://www.anthropic.com).

## Giấy phép

Phát hành theo [MIT License](LICENSE).
