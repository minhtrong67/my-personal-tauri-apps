<div align="center">

<img src="src-tauri/icons/icon.png" width="112" alt="Biểu tượng Material Video Player" />

# Material Video Player

**Trình phát video đầy đủ tính năng cho Windows, giao diện Material Design 3.**

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-DEA584?logo=rust&logoColor=black)
![Design](https://img.shields.io/badge/Design-Material%20Design%203-6750A4)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

[English](README.md) · Tiếng Việt

</div>

---

## Điểm nổi bật

- **Material Design 3 toàn diện** – bảng màu động sinh ra từ một màu chủ đề, bề mặt tonal, hiệu ứng trạng thái, bo góc, slider, hộp thoại và snackbar chuẩn M3.
- **Giao diện sáng, tối hoặc theo hệ thống**, kèm **tùy chỉnh màu chủ đề** (màu có sẵn hoặc chọn màu bất kỳ).
- **Hai ngôn ngữ: Tiếng Việt và English** – đổi ngay trong Cài đặt hoặc tự theo ngôn ngữ hệ thống.
- **Font hệ thống** (`system-ui`) – dùng font gốc của Windows, không đóng gói font riêng.
- **Bộ cài chuyên nghiệp** – có icon ứng dụng, icon bộ cài (setup) và icon gỡ cài đặt (uninstall) cùng phong cách thiết kế.

## Tính năng

### Thư viện
- **Tự động quét thư mục Videos của Windows** – khi mở app, Material Video Player quét thư mục *Videos* (gồm cả thư mục con như *Captures*, *Screen Recordings*) và nhập toàn bộ vào tab **Thư viện**
- **Nút Làm mới** (thanh tiêu đề, tab Thư viện hoặc phím `F5`) quét lại ngay; tệp đã xóa sẽ biến mất khỏi thư viện, tệp mới hoặc đã đổi được cập nhật
- Nhập lại tệp đã có sẽ **ghi đè** chứ không tạo bản sao (nhận diện theo đường dẫn)
- An toàn: nếu ổ đĩa hoặc thư mục tạm thời không kết nối (ví dụ rút ổ cứng), video của nó vẫn được giữ lại
- Thêm thư mục khác trong *Cài đặt → Thư viện*; tìm kiếm, sắp xếp theo ngày / tên / dung lượng, chuyển giữa **dạng danh sách và dạng ô**; ảnh thu nhỏ tạo dần cho video đang hiển thị (bỏ qua khung hình đen) và được lưu đệm

### Phát video
- Mở tệp, cả thư mục, kéo thả, hoặc **Mở bằng Material Video Player** từ Explorer; chỉ chạy một cửa sổ (mở thêm tệp sẽ dùng lại cửa sổ đang chạy)
- Danh sách phát có kéo thả sắp xếp, ngẫu nhiên, lặp (tắt / tất cả / một video); tự thêm các video khác trong cùng thư mục (có thể tắt)
- **Xem tiếp** từ vị trí đang xem dở cho từng video, kèm mục *Xem tiếp* có ảnh thu nhỏ và thanh tiến độ
- Tốc độ 0.25× – 4×, **lặp đoạn A-B**, tua từng khung hình (`,` và `.`)
- **Xem trước khung hình** khi rê chuột lên thanh tua
- Con lăn chuột chỉnh âm lượng, **khuếch đại âm lượng tới 200 %**, **chế độ ban đêm** (nén dải động)
- Nhấp đúp bên trái / phải để tua, nhấp đúp giữa để toàn màn hình

### Danh sách phát & menu chuột phải
- Thanh danh sách phát có **ô tìm kiếm**, nút chuyển **danh sách / ô** (đều có ảnh thu nhỏ), kéo thả sắp xếp, menu chuột phải cho từng mục (phát, phát tiếp theo, hiện trong thư mục, sao chép đường dẫn, xóa) và tự cuộn tới video đang phát
- **Chuột phải lên video** để mở menu đầy đủ: phát / tạm dừng, tua nhanh (±10 giây, ±30 giây, ±1 phút), tốc độ, danh sách phát, phụ đề (track, tải tệp, độ trễ, kiểu), âm thanh (tắt tiếng, chế độ ban đêm, khuếch đại), hình ảnh (vừa khung, xoay, lật, chỉnh sửa), lặp A-B, chụp ảnh, **sao chép khung hình vào clipboard**, toàn màn hình, trình phát mini, luôn ở trên cùng, thao tác tệp (hiện trong thư mục, sao chép đường dẫn, thông tin, mở bằng ứng dụng mặc định) và đóng video

### Chuyển động
Hiệu ứng mượt theo phong cách Material: thẻ xuất hiện lần lượt, nhấc lên và phóng nhẹ ảnh khi rê chuột, nút chuyển chế độ trượt, dấu tích có hiệu ứng, khung chờ lấp lánh khi ảnh thu nhỏ đang tạo, video hiện dần, chuyển màn hình và phản hồi khi bấm. Tự giảm chuyển động nếu bạn tắt *Animation effects* của Windows.

### Hình ảnh
- Vừa khung / lấp đầy (cắt) / kéo giãn, thu phóng tới 400 % và kéo để di chuyển
- Xoay 90°, lật ngang / dọc
- Chỉnh độ sáng, tương phản, bão hòa, sắc độ
- **Chụp ảnh màn hình** khung hình hiện tại, lưu PNG vào `Pictures\Material Video Player`

### Phụ đề
- Tự tìm `.srt`, `.vtt`, `.ass`, `.ssa` cạnh video (hoặc trong thư mục `Subs` / `Subtitles`) và ưu tiên ngôn ngữ giao diện
- Tải tệp phụ đề thủ công hoặc kéo thả vào cửa sổ
- Tự nhận dạng bảng mã (BOM, UTF-8, Windows-1258 cho tiếng Việt, Windows-1252 cho còn lại)
- Chỉnh độ trễ (`G` / `H`), cỡ chữ, màu, nền (không / bóng / hộp), độ đậm và vị trí

### Tích hợp Windows
- Thanh tiêu đề Material tự vẽ, toàn màn hình và **trình phát mini** luôn ở trên cùng
- Hỗ trợ phím media của Windows
- Hẹn giờ tắt (15 – 120 phút hoặc sau video hiện tại)
- Liên kết tệp cho các định dạng video phổ biến (cấu hình trong bộ cài)

## Định dạng được hỗ trợ

Material Video Player phát video bằng bộ giải mã của **Microsoft Edge WebView2**, nên khả năng phát phụ thuộc vào codec có trên máy.

| Container | Codec thường gặp | Ghi chú |
|---|---|---|
| MP4 / M4V / MOV | H.264 + AAC | Phát tốt trên mọi máy |
| WebM | VP8 / VP9 / AV1 + Vorbis / Opus | Phát tốt (AV1 có thể cần tiện ích AV1 Video Extension) |
| MKV | H.264 / VP9 + AAC / Opus / MP3 | Phát được nếu codec bên trong được hỗ trợ |
| HEVC / H.265 | – | Cần cài *HEVC Video Extensions* từ Microsoft Store |
| AVI, WMV, FLV, MPG | – | Thường không hỗ trợ; Material Video Player có nút **Mở bằng ứng dụng mặc định** khi không phát được |

> WebView2 không cho truy cập phụ đề nhúng và nhiều track âm thanh trong tệp. Hãy dùng tệp phụ đề rời.

## Phím tắt

`Space` / `K` phát-dừng · `←` `→` tua (5 / 10 / 15 giây tùy chỉnh) · `J` `L` tua 10 giây · `↑` `↓` âm lượng · `M` tắt tiếng · `F` / `F11` toàn màn hình · `[` `]` chậm / nhanh · `,` `.` khung hình trước / sau · `Shift+N` / `Shift+P` video tiếp / trước · `C` đổi phụ đề · `V` bật-tắt phụ đề · `G` `H` độ trễ phụ đề · `A` lặp A-B · `S` chụp ảnh · `Q` danh sách phát · `R` xoay 90° · `T` trình phát mini · `0`–`9` nhảy tới 0–90 % · `I` thông tin · `Ctrl+O` mở tệp (`Shift`: thư mục) · `F5` làm mới thư viện · chuột phải: menu ngữ cảnh · `Esc` thoát toàn màn hình / mini

## Bắt đầu

### Yêu cầu
- Windows 10 / 11 (đã có WebView2)
- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) bản stable và *Desktop development with C++*
- Điều kiện của Tauri: <https://tauri.app/start/prerequisites/>

### Chạy khi phát triển
```bash
cd material-video-player
npm install
npm run tauri dev
```

### Đóng gói bộ cài
```bash
npm run tauri build
```
Bộ cài NSIS (`Material Video Player_1.0.0_x64-setup.exe`) nằm ở `target/release/bundle/nsis/`; chương trình sau khi cài là `material-video-player.exe`, lối tắt trong Start menu tên **Material Video Player**.

### Icon
Icon ứng dụng, icon bộ cài (setup) và icon gỡ cài đặt (uninstall) dùng chung một hình, kèm đầy đủ các kích thước hiển thị chuẩn của Windows:

| Tệp | Dùng cho | Kích thước |
|---|---|---|
| `src-tauri/icons/icon.ico` | ứng dụng / thanh tác vụ / Explorer / cửa sổ | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `src-tauri/icons/installer.ico` | tệp setup `.exe` **và** `uninstall.exe` | 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 px |
| `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` (256), `256x256.png`, `icon.png` (512) | Tauri / bundler / màn hình độ phân giải cao | theo tên tệp |

Đủ cho mức thu phóng hiển thị 100 % – 400 % và mọi kiểu xem trong Explorer (danh sách, chi tiết, biểu tượng lớn và rất lớn).

### Dùng trong workspace Cargo có sẵn
Nếu thư mục này nằm cạnh các app Tauri khác dùng chung `Cargo.toml` gốc, thêm vào `members`:

```toml
[workspace]
members = [
  # ...các app hiện có...
  "material-video-player/src-tauri",
]
```

## Tùy biến

| Nội dung | Vị trí |
|---|---|
| Icon ứng dụng | thay `src-tauri/icons/icon.png` (vuông, ≥ 512 px) rồi chạy `npm run tauri icon src-tauri/icons/icon.png` |
| Icon bộ cài + gỡ cài đặt | `src-tauri/icons/installer.ico` (khai báo ở `bundle.windows.nsis` trong `tauri.conf.json`); giữ đủ các kích thước chuẩn trong tệp |
| Màu chủ đề mặc định | `defaultSettings.seedColor` trong `src/lib/types.ts` |
| Thêm ngôn ngữ | thêm từ điển trong `src/lib/i18n.ts` (TypeScript kiểm tra đủ khóa dịch) |

Dữ liệu người dùng (cài đặt, thư viện, lịch sử, vị trí xem dở) lưu tại `%APPDATA%\com.minhtrong67.material-video-player\state.json`; ảnh thu nhỏ lưu đệm tại `%LOCALAPPDATA%\com.minhtrong67.material-video-player\thumbs`.

## Khắc phục sự cố

- **"Không thể phát video này"** – codec không được WebView2 hỗ trợ. Cài *HEVC Video Extensions* (cho H.265) hoặc bấm **Mở bằng ứng dụng mặc định**.
- **Không có tiếng khi bật khuếch đại / chế độ ban đêm** – các hiệu ứng này dùng Web Audio; nếu hệ thống chặn, hộp thoại sẽ báo và video vẫn phát bình thường.
- **Explorer vẫn hiện icon cũ sau khi cài lại** – Windows lưu cache icon; đổi tên tệp hoặc khởi động lại Explorer.

## Ghi công

Thiết kế và phát triển bởi **minhtrong67**, với sự hỗ trợ của trợ lý AI **Claude** (Anthropic).

Xây dựng với [Tauri](https://tauri.app), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Zustand](https://zustand-demo.pmnd.rs), [Material Color Utilities](https://github.com/material-foundation/material-color-utilities) và [Material Symbols](https://fonts.google.com/icons).

## Giấy phép

[MIT](LICENSE) © 2026 minhtrong67
