<div align="center">

<img src="src/assets/logo.svg" alt="Logo Material Note" width="120" height="120">

# Material Note

**Ứng dụng ghi chú nhanh, nhiều thẻ, thiết kế Material Design 3 — xây dựng bằng Tauri.**

[English](README.md) · [Tiếng Việt](README.vi.md)

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.77%2B-DEA584?logo=rust&logoColor=white)
![Design](https://img.shields.io/badge/Design-Material%203-6750A4)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Giới thiệu

Material Note là ứng dụng ghi chú desktop gọn nhẹ, lấy cảm hứng từ Notepad của Windows nhưng được thiết kế
lại theo phong cách **Material Design 3** của Google. Ứng dụng khởi động nhanh, tốn ít bộ nhớ
(Tauri + WebView của hệ thống) và không làm phiền bạn khi viết.

## Tính năng

| Nhóm | Nội dung |
| --- | --- |
| **Tài liệu** | Nhiều thẻ, Mới / Mở (chọn nhiều tệp) / Lưu / Lưu thành, hỏi lưu khi có thay đổi, kéo thả tệp, mở lại tệp khi khởi động, mở từ dòng lệnh hoặc "Mở bằng" |
| **Soạn thảo** | Hoàn tác / làm lại, cắt / sao chép / dán, chọn tất cả, xoá, chèn giờ & ngày (`F5`), đi tới dòng, đổi CRLF ⇄ LF |
| **Tìm & thay thế** | Tìm tiếp / trước, thay thế, thay tất cả, phân biệt hoa thường, cả từ (hỗ trợ Unicode), biểu thức chính quy, đếm kết quả trực tiếp |
| **Xem** | Thẻ dọc hoặc ngang, thu phóng (`Ctrl` + `+` / `-` / `0` / lăn chuột), tự xuống dòng, thanh trạng thái (dòng, cột, số ký tự, thu phóng, mã hoá, kiểu xuống dòng), toàn màn hình |
| **Giao diện** | Sáng / tối / theo hệ thống, **màu chủ đề tuỳ chỉnh** (màu có sẵn + bộ chọn màu), phông system-ui, tuỳ chọn phông đơn cách hoặc có chân, chỉnh cỡ chữ, hiệu ứng chuyển động mượt kiểu Material (ripple, chuyển cảnh hộp thoại và menu; tôn trọng cài đặt giảm chuyển động) |
| **Ngôn ngữ** | Tiếng Anh và Tiếng Việt, đổi ngay khi đang chạy; tự nhận diện ở lần mở đầu tiên |
| **In ấn** | Hộp thoại in của hệ thống (`Ctrl+P`) |
| **Đóng gói** | Icon ứng dụng, icon trình cài đặt, icon gỡ cài đặt, hình ảnh cho bộ cài NSIS và MSI — đều theo phong cách Material 3 |

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

## Cách hoạt động của màu chủ đề

Chọn một màu bất kỳ tại **Cài đặt → Màu chủ đề**. Material Note chuyển màu đó sang OKLCH rồi tạo các vai trò
màu của Material 3 (primary, secondary container, surface containers, outline…) cho cả giao diện sáng
và tối. Phần này nằm trong `src/theme.js` và `src/styles.css`. Đây là cách xấp xỉ bảng màu HCT chính
thức, không phải bản sao chính xác.

## Cấu trúc dự án

```
material-note/
├── src/                      # Giao diện (HTML / CSS / JS thuần, không cần bundler)
│   ├── index.html
│   ├── styles.css            # Token và component Material Design 3
│   ├── theme.js              # Màu gốc → bảng màu M3, sáng/tối/hệ thống
│   ├── i18n.js               # Chuỗi tiếng Anh + tiếng Việt
│   ├── app.js                # Thẻ, tệp, tìm/thay thế, menu, cài đặt
│   └── assets/logo.svg
├── src-tauri/                # Backend Rust
│   ├── src/main.rs           # Lệnh đọc/ghi tệp
│   ├── tauri.conf.json       # Cửa sổ, đóng gói, trình cài đặt
│   ├── capabilities/         # Quyền của Tauri
│   └── icons/                # Icon ứng dụng + installer/ (icon cài đặt & gỡ cài đặt, hình ảnh)
├── tools/generate_icons.py   # Tạo lại toàn bộ icon bằng code
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
cd material-note

npm install        # một lần: cài Tauri CLI
npm run dev        # chạy chế độ phát triển
npm run build      # build bộ cài đặt
```

Dự án là một thành viên của Cargo workspace cha (`members = ["*/src-tauri"]`) nên dùng chung thư mục
`target/`. File build nằm ở `<workspace>/target/release/bundle/`. Nếu muốn dùng riêng lẻ, thêm bảng
`[workspace]` rỗng vào `src-tauri/Cargo.toml`.

### Bộ cài đặt

| Định dạng | Vị trí | Ghi chú |
| --- | --- | --- |
| NSIS `.exe` | `target/release/bundle/nsis/` | Cài cho người dùng hiện tại, có hình header & sidebar riêng |
| MSI `.msi` | `target/release/bundle/msi/` | Có banner & hình hộp thoại riêng (build trên Windows) |

> **Về icon gỡ cài đặt.** File `icons/installer/uninstall.ico` đã được tạo sẵn, nhưng mẫu NSIS của Tauri
> hiện dùng chung một `installerIcon` cho cả trình cài đặt và trình gỡ cài đặt. Nếu muốn dùng bản
> gỡ cài đặt, hãy đổi đường dẫn trong `tauri.conf.json`.

## Tuỳ biến

- **Màu thương hiệu / icon:** sửa bảng màu ở đầu `tools/generate_icons.py`, chạy lại script rồi build lại.
- **Màu chủ đề mặc định:** đổi `DEFAULTS.seed` trong `src/app.js` và giá trị `--h` / `--c` trong `src/styles.css`.
- **Thêm ngôn ngữ:** thêm bộ chuỗi vào `src/i18n.js` và một lựa chọn trong `src/index.html`.

## Giới hạn

- Tệp được đọc/ghi dạng UTF-8 (BOM bị bỏ; byte không hợp lệ được thay thế).
- Lịch sử hoàn tác tính riêng từng thẻ và mất khi đóng thẻ.
- Màu sắc dùng `oklch()` và `color-mix()`, cần WebView2 / WebKit đủ mới.

## Ghi công

Tác giả: **minhtrong67**, với sự hỗ trợ của **Claude**, trợ lý AI của [Anthropic](https://www.anthropic.com).

## Giấy phép

Phát hành theo [MIT License](LICENSE).
