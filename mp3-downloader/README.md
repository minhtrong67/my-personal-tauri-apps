# MP3 Downloader (Tauri 2 + Material Design 3)

Tải nhạc MP3 từ link YouTube, TikTok, Spotify. Tệp MP3 có sẵn ảnh bìa, tên bài, nghệ sĩ, album, năm.

**Tác giả:** minhtrong67 · **Hỗ trợ phát triển:** Claude (Anthropic)

## Thêm vào workspace
Mở `Cargo.toml` ở thư mục `tauri-apps` và thêm vào `members`:

    members = [ ..., "mp3-downloader/src-tauri" ]

## Chạy
    cd mp3-downloader
    npm install
    npm run dev        # hoặc: cargo tauri dev
    npm run build      # đóng gói bản cài đặt

Lần đầu mở app, bấm "Cài đặt tự động" (hoặc vào Cài đặt → Công cụ) để cài **yt-dlp**, **ffmpeg** và **Deno**
(Windows tự động; macOS/Linux cài ffmpeg, Deno bằng brew/apt). Deno giúp yt-dlp tránh lỗi HTTP 403 trên YouTube.

## Tính năng
- Chất lượng: Tốt nhất (V0) hoặc 320/256/192/128 kbps. Lưu mặc định vào thư mục Downloads.
- Tên tệp: `Nghệ sĩ - Tên bài hát` (vd: `Gryffin, ILLENIUM - Feel Good ft. Daya.mp3`).
- Nút dán đọc clipboard hệ thống (crate `arboard`), toast khi tải xong kèm nút "Hiện" mở thư mục.
- Gặp HTTP 403: tự thử lần lượt các client/cách tải khác trước khi báo lỗi.
- Metadata là tuỳ chọn: lỗi gắn ảnh/thông tin không làm mất tệp MP3.
- Màu chủ đề Material 3 tuỳ chỉnh, chế độ sáng/tối.

## Icon cho bộ cài đặt
- `src-tauri/icons/installer.ico` → icon file setup (`bundle.windows.nsis.installerIcon`)
- `src-tauri/icons/uninstaller.ico` → icon file gỡ cài đặt (`bundle.windows.nsis.uninstallerIcon`)
- Hai tệp có cấu trúc giống nhau (16–256 px) vì NSIS yêu cầu vậy; đã thử biên dịch bằng `makensis`.
- Thay icon: tạo lại 2 tệp .ico (đủ 16, 24, 32, 48, 64, 128, 256 px) rồi build lại.
- File setup nằm ở `target/release/bundle/nsis/` (thư mục `target` của workspace).

## Cách hoạt động
- YouTube/TikTok: yt-dlp tải âm thanh tốt nhất → ffmpeg chuyển MP3 → gắn metadata + thumbnail (cắt vuông tuỳ chọn).
- Spotify (DRM, không tải trực tiếp): đọc tên bài/nghệ sĩ/album/năm/ảnh bìa từ trang Spotify, tìm bản âm thanh khớp thời lượng
  trên YouTube Music/YouTube, tải rồi ghi thẻ ID3v2.3 + ảnh bìa bằng ffmpeg (Windows Explorer hiện ảnh bìa ổn định). Chỉ hỗ trợ link `/track/…`.

## Cấu trúc
    src/                   giao diện (HTML/CSS/JS thuần, không cần bundler)
    src-tauri/src/lib.rs   toàn bộ backend Rust
    src-tauri/icons        icon ứng dụng (mũi tên tải xuống), thay bằng `cargo tauri icon your.png`

Chỉ tải nội dung bạn có quyền sử dụng.
